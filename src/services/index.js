

import config from 'config';
import RabbitMQService from './rabbitmq';

/**
 * Responsible for establishing connections to all external services
 * Also has a hook to load mock services for unit testing.
 *
 * @param   {Object}        app       the app object
 * @param   {Object}        logger    the logger to use
 *
 * @return  {Void}                    the function returns void
 */
module.exports = (app, logger) => {
  app.services = app.service || {};
  if (process.env.NODE_ENV.toLowerCase() === 'test') {
    require('../tests/serviceMocks')(app);
  } else {
    // RabbitMQ Initialization
    app.services.pubsub = new RabbitMQService(app, logger);

    // initialize RabbitMQ
    app.services.pubsub.init(
      config.get('rabbitmqURL'),
      config.get('pubsubExchangeName'),
      config.get('pubsubQueueName'),
    )
      .then(() => {
        logger.info('RabbitMQ service initialized');
      })
      .catch((err) => {
        logger.error('Error initializing services', err);
        // gracefulShutdown()
      });

    // // elasticsearch
    // var esConfig = {
    //   hosts: config.get('esUrl'),
    //   apiVersion: '1.5'
    // }
    // if (process.env.NODE_ENV.toLowerCase() !== 'local') {
    //   _.assign(esConfig, {
    //     connectionClass: require('http-aws-es'),
    //     amazonES: {
    //       region: "us-east-1",
    //       accessKey: config.get('awsAccessKey'),
    //       secretKey: config.get('awsAccessSecret')
    //     }
    //   })
    // }
    // app.services.es = require('elasticsearch').Client(esConfig)
  }
};
