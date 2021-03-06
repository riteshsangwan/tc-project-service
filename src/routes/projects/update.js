'use strict'
import validate from 'express-validation'
import _ from 'lodash'
import Joi from 'joi'
import models from '../../models'
import { PROJECT_TYPE, PROJECT_STATUS, PROJECT_MEMBER_ROLE, EVENT } from '../../constants'
import util from '../../util'
import directProject from '../../services/directProject'
import { middleware as tcMiddleware } from 'tc-core-library-js'

/**
 * API to handle updating a project.
 */
const permissions = tcMiddleware.permissions

/**
 * Customizer used to merge project properties -
 * Used with lodash mergeWith, recursively merges all values except array type
 * values which are replaced.
 */
const mergeCustomizer = (objValue, srcValue) => {
  if (_.isArray(objValue))
    return srcValue
}

const updateProjectValdiations = {
  body: {
    param: Joi.object().keys({
      id: Joi.number().valid(Joi.ref('$params.id')),
      name: Joi.string(),
      description: Joi.string(),
      billingAccountId: Joi.number().positive(),
      status: Joi.any().valid(_.values(PROJECT_STATUS)),
      estimatedPrice: Joi.number().precision(2).positive().allow(null),
      actualPrice: Joi.number().precision(2).positive(),
      terms: Joi.array().items(Joi.number().positive()),
      external: Joi.object().keys({
        id: Joi.string(),
        type: Joi.any().valid('github', 'jira', 'asana', 'other'),
        data: Joi.string().max(300) // TODO - restrict length
      }).allow(null),
      bookmarks: Joi.array().items(Joi.object().keys({
        title: Joi.string(),
        address: Joi.string()
      })).optional().allow(null),
      type: Joi.any().valid(_.values(PROJECT_TYPE)),
      details: Joi.any(),
      memers: Joi.any(),
      createdBy: Joi.any(),
      createdAt: Joi.any(),
      updatedBy: Joi.any(),
      updatedAt: Joi.any(),
      challengeEligibility: Joi.array().items(Joi.object().keys({
        role: Joi.string().valid('submitter', 'reviewer', 'copilot'),
        users: Joi.array().items(Joi.number().positive()),
        groups: Joi.array().items(Joi.number().positive())
      })).allow(null)
    })
  }
}

// NOTE- decided to disable all additional checks for now.
var validateUpdates = (existingProject, updatedProject) => {
  var errors = []
  switch (existingProject.status) {
    case PROJECT_STATUS.COMPLETED:
    case PROJECT_STATUS.CANCELLED:
      errors.push(`cannot update a project that is in ${existingProject.status}' state`)
      break
    // disabling this check for now.
    // case PROJECT_STATUS.DRAFT:
    //   if (_.get(updatedProject, 'status', '') === 'active') {
    //     // attempting to launch the project make sure certain
    //     // properties are set
    //     if (!updatedProject.billingAccountId && !existingProject.billingAccountId) {
    //       errors.push('\'billingAccountId\' must be set before activating the project')
    //     }
    //   }
  }
  return errors
}

module.exports = [
  // handles request validations
  // validate(updateProjectValdiations),
  permissions('project.edit'),
  /**
   * POST projects/
   * Create a project if the user has access
   */
      (req, res, next) => {
    var project,
        updatedProps = req.body.param
    var projectId = _.parseInt(req.params.projectId)
    // prune any fields that cannot be updated directly
    updatedProps = _.omit(updatedProps, ['createdBy', 'createdAt', 'updatedBy', 'updatedAt', 'id', 'directProjectId'])

    let previousValue
    models.sequelize.transaction(() => {
      return models.Project.findOne({
        where: { id: projectId },
        lock: { of: models.Project }
      })
        .then((_prj) => {
          project = _prj
          if (!project) {
            // handle 404
            let err = new Error(`project not found for id ${projectId}`)
            err.status = 404
            return Promise.reject(err)
          }
          previousValue = _.clone(project.get({plain: true}))
          // run additional validations
          let validationErrors = validateUpdates(previousValue, updatedProps)
          if(validationErrors.length > 0) {
            let err = new Error('Unable to update project')
            _.assign(err, {
              details: JSON.stringify(validationErrors),
              status: 400
            })
            return Promise.reject(err)
          }
          // Only project manager (user with manager role assigned) should be allowed to transition project status to 'active'.
          const members = req.context.currentProjectMembers
          const validRoles = [PROJECT_MEMBER_ROLE.MANAGER,  PROJECT_MEMBER_ROLE.MANAGER].map(x => x.toLowerCase())
          const matchRole = (role) => _.indexOf(validRoles, role.toLowerCase()) >= 0
          if(updatedProps.status === PROJECT_STATUS.ACTIVE &&
              _.isUndefined(_.find(members, (m) => m.userId === req.authUser.userId && matchRole(m.role)))) {
            let err = new Error('Only assigned topcoder-managers should be allowed to launch a project')
            err.status = 403
            return Promise.reject(err)
          }

          // no updates if same

          if (_.isEqual(previousValue, updatedProps)) {
            return Promise.resolve()
          }
          updatedProps.updatedBy = req.authUser.userId
          const newValues = _.mergeWith({}, previousValue, updatedProps, mergeCustomizer)
          project.set(newValues)
          return project.save()
        })
        .then(() => {
          if (updatedProps.billingAccountId && (previousValue.billingAccountId !== updatedProps.billingAccountId)) {
            if(!previousValue.directProjectId){
              return Promise.resolve()
            } else {
              // if billing account is updated and exist direct project id we should invoke direct project service
              return directProject.addBillingAccount(req, previousValue.directProjectId, {
                billingAccountId: updatedProps.billingAccountId
              })
            }
          } else {
            return Promise.resolve()
          }
        })
        .then(() => {
          return project.reload(project.id)
        })
        .then(() => {
          project = project.get({plain: true})
          project = _.omit(project, ['deletedAt'])
          req.log.debug('updated project', project)
          previousValue =  _.omit(previousValue, ['deletedAt'])
          // publish original and updated project data
          req.app.services.pubsub.publish(
            EVENT.ROUTING_KEY.PROJECT_UPDATED,
            { original: previousValue, updated: project },
            { correlationId: req.id }
          )
          req.app.emit(EVENT.ROUTING_KEY.PROJECT_UPDATED, {
            req,
            original: previousValue,
            updated: project
          })
          // check context for project members
          project.members = req.context.currentProjectMembers
          // get attachments
          return util.getProjectAttachments(req, project.id)
        })
        .then((attachments) => {
          project.attachments = attachments
          res.json(util.wrapResponse(req.id, project))
        })
        .catch((err) => next(err))
    })
  }
]
