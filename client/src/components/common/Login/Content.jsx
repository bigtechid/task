/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import isEmail from 'validator/lib/isEmail';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button, Form, Message } from 'semantic-ui-react';
import { useDidUpdate, usePrevious, useToggle } from '../../../lib/hooks';
import { Input } from '../../../lib/custom-ui';
import { redirectToOidcProvider } from '../../../utils/oidc';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import { useForm, useNestedRef } from '../../../hooks';
import { isUsername } from '../../../utils/validator';
import AccessTokenSteps from '../../../constants/AccessTokenSteps';
import TermsModal from './TermsModal';
import TotpChallengeModal from './TotpChallengeModal';

import logoHeader from '../../../assets/images/logo-header.png';

import styles from './Content.module.scss';

const createMessage = (error) => {
  if (!error) {
    return error;
  }

  switch (error.message) {
    case 'Invalid credentials':
      return {
        type: 'error',
        content: 'common.invalidCredentials',
      };
    case 'Invalid email or username':
      return {
        type: 'error',
        content: 'common.invalidEmailOrUsername',
      };
    case 'Invalid password':
      return {
        type: 'error',
        content: 'common.invalidPassword',
      };
    case 'Admin login required to initialize instance':
      return {
        type: 'error',
        content: 'common.adminLoginRequiredToInitializeInstance',
      };
    case 'Email already in use':
      return {
        type: 'error',
        content: 'common.emailAlreadyInUse',
      };
    case 'Username already in use':
      return {
        type: 'error',
        content: 'common.usernameAlreadyInUse',
      };
    case 'Active users limit reached':
      return {
        type: 'error',
        content: 'common.activeUsersLimitReached',
      };
    case 'User not registered':
      return {
        type: 'error',
        content: 'common.userNotRegistered',
      };
    case 'Email domain not allowed':
      return {
        type: 'error',
        content: 'common.emailDomainNotAllowed',
      };
    case 'Email not verified':
      return {
        type: 'error',
        content: 'common.emailNotVerified',
      };
    case 'Invalid OIDC code':
    case 'Invalid OIDC state':
      return {
        type: 'error',
        content: 'common.ssoLoginFailed',
      };
    case 'OIDC login cancelled':
      return {
        type: 'warning',
        content: 'common.ssoLoginCancelled',
      };
    case 'Failed to fetch':
      return {
        type: 'warning',
        content: 'common.noInternetConnection',
      };
    case 'Network request failed':
      return {
        type: 'warning',
        content: 'common.serverConnectionFailed',
      };
    default:
      return {
        type: 'warning',
        content: 'common.unknownError',
      };
  }
};

const Content = React.memo(() => {
  const bootstrap = useSelector(selectors.selectBootstrap);

  const {
    data: defaultData,
    isSubmitting,
    error,
    step,
  } = useSelector(selectors.selectAuthenticateForm);

  const dispatch = useDispatch();
  const [t] = useTranslation();
  const wasSubmitting = usePrevious(isSubmitting);

  const [data, handleFieldChange, setData] = useForm(() => {
    const initialData = {
      emailOrUsername: '',
      password: '',
      ...defaultData,
    };

    if (bootstrap.isDemoMode) {
      const params = new URLSearchParams(window.location.hash.slice(1));

      Object.keys(initialData).forEach((fieldName) => {
        const value = params.get(fieldName);

        if (value !== null) {
          initialData[fieldName] = value;
        }
      });
    }

    return initialData;
  });

  const message = useMemo(() => createMessage(error), [error]);
  const [focusPasswordFieldState, focusPasswordField] = useToggle();

  const [emailOrUsernameFieldRef, handleEmailOrUsernameFieldRef] = useNestedRef('inputRef');
  const [passwordFieldRef, handlePasswordFieldRef] = useNestedRef('inputRef');

  const handleSubmit = useCallback(() => {
    const cleanData = {
      ...data,
      emailOrUsername: data.emailOrUsername.trim(),
    };

    if (!isEmail(cleanData.emailOrUsername) && !isUsername(cleanData.emailOrUsername)) {
      emailOrUsernameFieldRef.current.select();
      return;
    }

    if (!cleanData.password) {
      passwordFieldRef.current.focus();
      return;
    }

    dispatch(entryActions.authenticate(cleanData));
  }, [dispatch, data, emailOrUsernameFieldRef, passwordFieldRef]);

  const handleSsoClick = useCallback(() => {
    redirectToOidcProvider(bootstrap.oidc.authorizationUrl);
  }, [bootstrap.oidc]);

  const handleMessageDismiss = useCallback(() => {
    dispatch(entryActions.clearAuthenticateError());
  }, [dispatch]);

  useEffect(() => {
    emailOrUsernameFieldRef.current.focus();
  }, [emailOrUsernameFieldRef]);

  useDidUpdate(() => {
    if (wasSubmitting && !isSubmitting && error) {
      switch (error.message) {
        case 'Invalid credentials':
        case 'Invalid email or username':
          emailOrUsernameFieldRef.current.select();

          break;
        case 'Invalid password':
          setData((prevData) => ({
            ...prevData,
            password: '',
          }));
          focusPasswordField();

          break;
        default:
      }
    }
  }, [isSubmitting, wasSubmitting, error]);

  useDidUpdate(() => {
    passwordFieldRef.current.focus();
  }, [focusPasswordFieldState]);

  return (
    <div className={styles.page}>
      <div className={styles.bg} aria-hidden="true" />
      <div className={styles.shell}>
        <div className={styles.brandBar}>
          <img src={logoHeader} alt="bigtech" className={styles.brandLogo} />
        </div>

        <div className={styles.card}>
          <h1 className={styles.title}>{t('common.logIn', { context: 'title' })}</h1>

          {message && (
            <Message
              {...{
                [message.type]: true,
              }}
              visible
              content={t(message.content)}
              onDismiss={handleMessageDismiss}
              className={styles.message}
            />
          )}

          <Form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-email">
                {t('common.emailOrUsername')}
              </label>
              <Input
                fluid
                id="login-email"
                ref={handleEmailOrUsernameFieldRef}
                name="emailOrUsername"
                value={data.emailOrUsername}
                maxLength={256}
                readOnly={isSubmitting}
                className={styles.input}
                onChange={handleFieldChange}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-password">
                {t('common.password')}
              </label>
              <Input.Password
                fluid
                id="login-password"
                ref={handlePasswordFieldRef}
                name="password"
                value={data.password}
                maxLength={256}
                readOnly={isSubmitting}
                className={styles.input}
                onChange={handleFieldChange}
              />
            </div>
            <Button
              fluid
              type="submit"
              content={t('action.logIn')}
              loading={isSubmitting}
              disabled={isSubmitting}
              className={styles.submit}
            />
          </Form>

          {bootstrap.oidc && (
            <>
              <div className={styles.divider}>{t('common.or')}</div>
              <Button
                fluid
                type="button"
                content={bootstrap.oidc.buttonText || t('action.logInWithSso')}
                disabled={isSubmitting}
                className={styles.sso}
                onClick={handleSsoClick}
              />
            </>
          )}
        </div>
      </div>

      {step === AccessTokenSteps.ACCEPT_TERMS && <TermsModal />}
      {step === AccessTokenSteps.VERIFY_TOTP && <TotpChallengeModal />}
    </div>
  );
});

export default Content;
