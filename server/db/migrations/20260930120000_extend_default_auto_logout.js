/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

module.exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE user_account
    ALTER COLUMN auto_logout_mode SET DEFAULT 'never'
  `);

  // Existing accounts inherited the previous 30m default and were getting
  // logged out after idle periods — move them to never unless already customized.
  await knex('user_account').where({ auto_logout_mode: '30m' }).update({
    auto_logout_mode: 'never',
  });
};

module.exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE user_account
    ALTER COLUMN auto_logout_mode SET DEFAULT '30m'
  `);

  await knex('user_account').where({ auto_logout_mode: 'never' }).update({
    auto_logout_mode: '30m',
  });
};
