/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const FETCH_TIMEOUT = 10000;

let configPromise = null;

module.exports = {
  async fn() {
    const { oidcIssuer, oidcClientId, oidcClientSecret } = sails.config.custom;

    if (!oidcIssuer || !oidcClientId || !oidcClientSecret) {
      return null;
    }

    if (!configPromise) {
      const url = `${oidcIssuer.replace(/\/$/, '')}/.well-known/openid-configuration`;

      configPromise = fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`OIDC discovery failed with status ${response.status}`);
          }

          return response.json();
        })
        .catch((error) => {
          configPromise = null; // Retry on next call
          throw error;
        });
    }

    return configPromise;
  },
};
