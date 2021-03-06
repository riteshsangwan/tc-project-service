'use strict'

import _ from 'lodash'

import models from '../../models'
import { middleware as tcMiddleware } from 'tc-core-library-js'
import { EVENT } from '../../constants'

/**
 * API to delete a project member.
 *
 */
const permissions = tcMiddleware.permissions

module.exports = [
  permissions('project.removeMember'),
  (req, res, next) => {
    var projectId = _.parseInt(req.params.projectId)
    var memberRecordId = _.parseInt(req.params.id)

    models.sequelize.transaction(() => {
      // soft delete the record
      return models.ProjectMember.findOne({
        where: {id: memberRecordId, projectId: projectId}
      })
          .then((member) => {
            if (!member) {
              let err = new Error('Record not found')
              err.status = 404
              return Promise.reject(err)
            }
            return member.destroy({logging: console.log})
          })
          .then(member => {
            return member.save()
          })
          .then(member => {
            // fire event
            member = member.get({plain:true})
            req.app.services.pubsub.publish(
              EVENT.ROUTING_KEY.PROJECT_MEMBER_REMOVED,
              member,
              { correlationId: req.id }
            )
            req.app.emit(EVENT.ROUTING_KEY.PROJECT_MEMBER_REMOVED, { req, member })
            res.status(204).json({})
          })
          .catch(err => next(err))
    })
  }
]
