/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const STORAGE_KEY = 'oidc';

const generateRandomString = () => {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const redirectToOidcProvider = (authorizationUrl) => {
  const state = generateRandomString();
  const nonce = generateRandomString();

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ state, nonce }));

  const url = new URL(authorizationUrl);
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);

  window.location.assign(url.href);
};

// Returns null when the current URL is not an OIDC callback
export const consumeOidcCallback = () => {
  const params = new URLSearchParams(window.location.search);

  if (!params.has('code') && !params.has('error')) {
    return null;
  }

  let stored = null;
  try {
    stored = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    /* empty */
  }

  window.sessionStorage.removeItem(STORAGE_KEY);
  window.history.replaceState(null, '', window.location.pathname);

  if (params.has('error')) {
    return {
      error: new Error('OIDC login cancelled'),
    };
  }

  if (!stored || params.get('state') !== stored.state) {
    return {
      error: new Error('Invalid OIDC state'),
    };
  }

  return {
    data: {
      code: params.get('code'),
      nonce: stored.nonce,
    },
  };
};
