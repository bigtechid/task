/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

module.exports = {
  sync: true,

  inputs: {
    internalConfig: {
      type: 'ref',
      required: true,
    },
    user: {
      type: 'ref',
    },
    oidcConfig: {
      type: 'ref',
    },
  },

  fn(inputs) {
    const data = {
      termsLanguages: sails.hooks.terms.getLanguages(),
      version: sails.config.custom.version,
    };

    if (inputs.oidcConfig) {
      const authorizationUrl = new URL(inputs.oidcConfig.authorization_endpoint);

      authorizationUrl.search = new URLSearchParams({
        response_type: 'code',
        client_id: sails.config.custom.oidcClientId,
        redirect_uri: sails.config.custom.oidcRedirectUri,
        scope: sails.config.custom.oidcScopes,
        prompt: 'select_account',
      });

      data.oidc = {
        authorizationUrl: authorizationUrl.href,
        buttonText: sails.config.custom.oidcButtonText,
      };
    }

    if (inputs.user && inputs.user.role === User.Roles.ADMIN) {
      Object.assign(data, {
        activeUsersLimit: inputs.internalConfig.activeUsersLimit,
        customerPanelUrl: sails.config.custom.customerPanelUrl,
      });
    }

    if (sails.config.custom.demoMode) {
      data.isDemoMode = true;
    }

    return data;
  },
};
