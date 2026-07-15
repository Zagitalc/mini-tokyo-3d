export const LONDON_ABOUT = Object.freeze({
    title: 'Mini London 3D',
    author: 'Long Hang Chung',
    sourceUrl: 'https://github.com/Zagitalc/mini-london-3d',
    upstreamTitle: 'Mini Tokyo 3D',
    upstreamUrl: 'https://github.com/nagix/mini-tokyo-3d'
});

export class LondonModalCoordinator {
    constructor({
        getBackgroundTargets,
        onActivate,
        onDeactivate,
        onFocus,
        onRestoreFocus
    }) {
        this.getBackgroundTargets = getBackgroundTargets;
        this.onActivate = onActivate;
        this.onDeactivate = onDeactivate;
        this.onFocus = onFocus;
        this.onRestoreFocus = onRestoreFocus;
        this.activeDialog = null;
        this.invokingControl = null;
        this.inertState = new Map();
    }

    isActive(name) {
        return this.activeDialog === name;
    }

    open(name, invokingControl) {
        if (!name || this.activeDialog === name) {
            return false;
        }

        if (!this.activeDialog) {
            this.acquireBackground();
        } else {
            this.onDeactivate(this.activeDialog);
        }

        this.activeDialog = name;
        this.invokingControl = invokingControl || null;
        this.onActivate(name);
        this.onFocus(name);
        return true;
    }

    close(name) {
        if (!this.activeDialog || (name && this.activeDialog !== name)) {
            return false;
        }

        const closingDialog = this.activeDialog;
        const invokingControl = this.invokingControl;

        this.onDeactivate(closingDialog);
        this.activeDialog = null;
        this.invokingControl = null;
        this.releaseBackground();
        this.onRestoreFocus(invokingControl);
        return true;
    }

    refreshInvokingControl(name, control) {
        if (this.activeDialog === name && (!this.invokingControl || !this.invokingControl.isConnected)) {
            this.invokingControl = control || null;
        }
    }

    acquireBackground() {
        if (this.inertState.size) {
            return;
        }

        for (const element of this.getBackgroundTargets()) {
            if (!element || !element.isConnected || this.inertState.has(element)) {
                continue;
            }
            this.inertState.set(element, element.inert);
            element.inert = true;
        }
    }

    releaseBackground() {
        for (const [element, previousValue] of this.inertState) {
            if (element.isConnected) {
                element.inert = previousValue;
            }
        }
        this.inertState.clear();
    }
}
