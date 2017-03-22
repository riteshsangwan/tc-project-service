/**
 * Event handlers for project create, update and delete
 */
import _ from 'lodash';
import config from 'config';
import urlencode from 'urlencode';
import util from '../../util';
import { ELASTICSEARCH_INDICES, ELASTICSEARCH_INDICES_TYPES } from '../../constants';

const eClient = util.getElasticSearchClient();

/**
 * Handler for project creation event
 * @param  {Object} logger  logger to log along with trace id
 * @param  {Object} msg     event payload
 * @param  {Object} channel channel to ack, nack
 * @returns {undefined}
 */
const projectCreatedHandler = (logger, msg, channel) => {
  const data = JSON.parse(msg.content.toString());

  const httpClient = util.getHttpClient({ id: msg.properties.correlationId });
  const userIds = data.members.map(single => urlencode(`userId&${single.userId}`, 'utf8'));
  // fetch the member information
  httpClient.get(`${config.membersServiceEndpoint}/_search?query=${userIds.join(urlencode(' OR ', 'utf8'))}`)
    .then((memberDetails) => {
      // if no members are returned than this should result in nack
      if (!_.isArray(memberDetails.data) || memberDetails.data.length === 0) {
        logger.error(`Empty member details for userIds ${userIds.join(',')} requeing the message`);
        channel.nack(msg, false, !msg.fields.redelivered);
      } else {
        data.members = data.members.map((single) => {
          const detail = _.filter(memberDetails.data, md => md.result.content.userId === single.userId);
          return _.merge(single, _.pick(detail[0].result.content, 'handle', 'firstName', 'lastName', 'email'));
        });
        eClient.create({
          index: ELASTICSEARCH_INDICES.TC_PROJECT_SERVICE,
          type: ELASTICSEARCH_INDICES_TYPES.PROJECT,
          id: data.id,
          body: data,
        }).then((resp) => {
          logger.debug('project indexed successfully', resp);
          channel.ack(msg);
        }).catch((error) => {
          logger.error('failed to index project', error);
          channel.nack(msg, false, !msg.fields.redelivered);
        });
      }
    }).catch((error) => {
      logger.error('Error fetching member details', error);
      channel.nack(msg, false, !msg.fields.redelivered);
    });
};

/**
 * Handler for project updated event
 * @param  {Object} logger  logger to log along with trace id
 * @param  {Object} msg     event payload
 * @param  {Object} channel channel to ack, nack
 * @returns {undefined}
 */
const projectUpdatedHandler = (logger, msg, channel) => {
  const data = JSON.parse(msg.content.toString());

  // first get the existing document and than merge the updated changes and save the new document
  eClient.get({
    index: ELASTICSEARCH_INDICES.TC_PROJECT_SERVICE,
    type: ELASTICSEARCH_INDICES_TYPES.PROJECT,
    id: data.original.id,
  }).then((doc) => {
    const merged = _.merge(doc._source, data.updated);        // eslint-disable-line no-underscore-dangle
    // update the merged document
    eClient.update({
      index: ELASTICSEARCH_INDICES.TC_PROJECT_SERVICE,
      type: ELASTICSEARCH_INDICES_TYPES.PROJECT,
      id: data.original.id,
      body: {
        doc: merged,
      },
    }).then(() => {
      logger.debug('project updated successfully in elasticsearh index');
      channel.ack(msg);
    }).catch((error) => {
      logger.error('failed to update project document', error);
      channel.nack(msg, false, !msg.fields.redelivered);
    });
  }).catch((error) => {
    logger.error('failed to get project document', error);
    channel.nack(msg, false, !msg.fields.redelivered);
  });
};

/**
 * Handler for project deleted event
 * @param  {Object} logger  logger to log along with trace id
 * @param  {Object} msg     event payload
 * @param  {Object} channel channel to ack, nack
 * @returns {undefined}
 */
const projectDeletedHandler = (logger, msg, channel) => {
  const data = JSON.parse(msg.content.toString());
  eClient.delete({
    index: ELASTICSEARCH_INDICES.TC_PROJECT_SERVICE,
    type: ELASTICSEARCH_INDICES_TYPES.PROJECT,
    id: data.id,
  }).then(() => {
    logger.debug('project deleted successfully from elasticsearh index');
    channel.ack(msg);
  }).catch((error) => {
    logger.error('failed to delete project document', error);
    channel.nack(msg, false, !msg.fields.redelivered);
  });
};


module.exports = {
  projectCreatedHandler,
  projectUpdatedHandler,
  projectDeletedHandler,
};
