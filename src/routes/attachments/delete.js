

// import validate from 'express-validation'
import _ from 'lodash';
import {
  middleware as tcMiddleware,
} from 'tc-core-library-js';
import models from '../../models';
import fileService from '../../services/fileService';

/**
 * API to delete a project member.
 *
 */

const permissions = tcMiddleware.permissions;

module.exports = [
  permissions('project.removeAttachment'),
  (req, res, next) => {
    const projectId = _.parseInt(req.params.projectId);
    const attachmentId = _.parseInt(req.params.id);

    models.sequelize.transaction(() =>
      // soft delete the record
       models.ProjectAttachment.findOne({
         where: {
           id: attachmentId,
           projectId,
         },
       })
        .then((attachment) => {
          if (!attachment) {
            const err = new Error('Record not found');
            err.status = 404;
            return Promise.reject(err);
          }
          return attachment.destroy();
        })
        .then((attachment) => {
          fileService.deleteFile(req, attachment.filePath);
        })
        .then(() => res.status(204).json({}))
        .catch(err => next(err)));
  },
];
