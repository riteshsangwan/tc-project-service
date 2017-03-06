

/* eslint-disable no-console */
/**
 * Sync the database models to db tables.
 */

/**
 * Make sure we are in development mode
 * @type {String}
 */
// process.env.NODE_ENV = 'development'

require('../src/models').default.sequelize.sync({ force: true })
  .then(() => {
    console.log('Database synced successfully');
    process.exit();
  }).catch((err) => {
    console.error('Error syncing database', err);
    process.exit(1);
  });
