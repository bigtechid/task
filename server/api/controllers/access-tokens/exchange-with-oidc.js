/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /access-tokens/exchange-with-oidc:
 *   post:
 *     summary: Exchange OIDC authorization code for access token
 *     description: Exchanges an authorization code from the configured OIDC provider for an access token. Only users that already exist (matched by verified email) can log in.
 *     tags:
 *       - Access Tokens
 *     operationId: exchangeWithOidc
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - nonce
 *             properties:
 *               code:
 *                 type: string
 *                 maxLength: 2048
 *                 description: Authorization code returned by the OIDC provider
 *               nonce:
 *                 type: string
 *                 maxLength: 256
 *                 description: Nonce sent with the authorization request
 *               withHttpOnlyToken:
 *                 type: boolean
 *                 description: Whether to include an HTTP-only authentication cookie
 *     responses:
 *       200:
 *         description: Access token created successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

const jwt = require('jsonwebtoken');

const { getRemoteAddress } = require('../../../utils/remote-address');

const FETCH_TIMEOUT = 10000;

const Errors = {
  OIDC_NOT_CONFIGURED: {
    oidcNotConfigured: 'OIDC not configured',
  },
  INVALID_OIDC_CODE: {
    invalidOidcCode: 'Invalid OIDC code',
  },
  EMAIL_NOT_VERIFIED: {
    emailNotVerified: 'Email not verified',
  },
  EMAIL_DOMAIN_NOT_ALLOWED: {
    emailDomainNotAllowed: 'Email domain not allowed',
  },
  USER_NOT_REGISTERED: {
    userNotRegistered: 'User not registered',
  },
};

const isAudienceValid = (aud, clientId) =>
  Array.isArray(aud) ? aud.includes(clientId) : aud === clientId;

module.exports = {
  inputs: {
    code: {
      type: 'string',
      maxLength: 2048,
      required: true,
    },
    nonce: {
      type: 'string',
      maxLength: 256,
      required: true,
    },
    withHttpOnlyToken: {
      type: 'boolean',
    },
  },

  exits: {
    oidcNotConfigured: {
      responseType: 'notFound',
    },
    invalidOidcCode: {
      responseType: 'unauthorized',
    },
    emailNotVerified: {
      responseType: 'forbidden',
    },
    emailDomainNotAllowed: {
      responseType: 'forbidden',
    },
    userNotRegistered: {
      responseType: 'forbidden',
    },
    termsAcceptanceRequired: {
      responseType: 'forbidden',
    },
    totpVerificationRequired: {
      responseType: 'forbidden',
    },
    adminLoginRequiredToInitializeInstance: {
      responseType: 'forbidden',
    },
  },

  async fn(inputs) {
    const { oidcClientId, oidcClientSecret, oidcRedirectUri, oidcAllowedDomains } =
      sails.config.custom;

    const remoteAddress = getRemoteAddress(this.req);
    const oidcConfig = await sails.helpers.utils.getOidcConfig();

    if (!oidcConfig) {
      throw Errors.OIDC_NOT_CONFIGURED;
    }

    const tokenResponse = await fetch(oidcConfig.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: inputs.code,
        redirect_uri: oidcRedirectUri,
        client_id: oidcClientId,
        client_secret: oidcClientSecret,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });

    if (!tokenResponse.ok) {
      sails.log.warn(
        `OIDC code exchange failed with status ${tokenResponse.status}! (IP: ${remoteAddress})`,
      );

      throw Errors.INVALID_OIDC_CODE;
    }

    const { id_token: idToken } = await tokenResponse.json();

    // The ID token comes straight from the token endpoint over TLS, which lets us skip
    // signature verification (OpenID Connect Core 1.0, section 3.1.3.7), but the claims
    // must still be checked
    const claims = idToken && jwt.decode(idToken);

    if (
      !claims ||
      claims.iss !== oidcConfig.issuer ||
      !isAudienceValid(claims.aud, oidcClientId) ||
      !claims.exp ||
      claims.exp * 1000 < Date.now() ||
      claims.nonce !== inputs.nonce
    ) {
      sails.log.warn(`Invalid OIDC ID token claims! (IP: ${remoteAddress})`);

      throw Errors.INVALID_OIDC_CODE;
    }

    if (!claims.email || (claims.email_verified !== true && claims.email_verified !== 'true')) {
      throw Errors.EMAIL_NOT_VERIFIED;
    }

    const email = claims.email.toLowerCase();

    if (oidcAllowedDomains.length > 0) {
      const domain = email.split('@').pop();

      if (!oidcAllowedDomains.includes(domain)) {
        sails.log.warn(`OIDC email domain not allowed: "${email}"! (IP: ${remoteAddress})`);

        throw Errors.EMAIL_DOMAIN_NOT_ALLOWED;
      }
    }

    const user = await User.qm.getOneByEmail(email);

    if (!user || user.isDeactivated) {
      sails.log.warn(`OIDC user not registered: "${email}"! (IP: ${remoteAddress})`);

      throw Errors.USER_NOT_REGISTERED;
    }

    return sails.helpers.accessTokens.handleSteps
      .with({
        user,
        remoteAddress,
        request: this.req,
        response: this.res,
        withHttpOnlyToken: inputs.withHttpOnlyToken,
      })
      .intercept('adminLoginRequiredToInitializeInstance', (error) => ({
        adminLoginRequiredToInitializeInstance: error.raw,
      }))
      .intercept('termsAcceptanceRequired', (error) => ({
        termsAcceptanceRequired: error.raw,
      }))
      .intercept('totpVerificationRequired', (error) => ({
        totpVerificationRequired: error.raw,
      }));
  },
};
