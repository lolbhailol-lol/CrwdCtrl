import { showLoginPopup } from './appPopup';

/** Show login-success popup on whatever page the user lands on. */
export function showLoginSuccessToast(message = 'You signed in to CrwdCtrl.') {
    showLoginPopup(message);
}
