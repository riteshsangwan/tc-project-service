// force using test.json for unit tests

let config;
if (process.env.NODE_ENV === 'test') {
  config = require('./test.json');
} else {
  config = {
    authSecret: 'secret',
    logLevel: 'debug',
    captureLogs: 'false',
    logentriesToken: '',
    rabbitmqURL: 'amqp://dockerhost:5672',
    fileServiceEndpoint: 'https://api.topcoder-dev.com/v3/files/',
    topicServiceEndpoint: 'https://api.topcoder-dev.com/v4/topics/',
    directProjectServiceEndpoint: 'https://api.topcoder-dev.com/v3/direct',
    userServiceUrl: 'https://api.topcoder-dev.com/v3/users',
    connectProjectsUrl: 'https://connect.topcoder-dev.com/projects/',
    membersServiceEndpoint: 'http://dockerhost:3001/members',
    salesforceLead: {
      webToLeadUrl: 'https://www.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8',
      orgId: '00D2C0000000dO6',
      projectNameFieldId: 'title',
      projectDescFieldId: 'description',
      projectLinkFieldId: 'URL',
      projectIdFieldId: '00N2C000000Vxxx',
    },
    dbConfig: {
      masterUrl: 'postgres://coder:mysecretpassword@dockerhost:5432/projectsdb',
      maxPoolSize: 50,
      minPoolSize: 4,
      idleTimeout: 1000,
    },
    elasticsearchConfig: {
      host: 'dockerhost:9200',
      // target elasticsearch 2.3 version
      apiVersion: '2.3',
    },
  };
}
module.exports = config;
