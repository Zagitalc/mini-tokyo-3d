import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {LONDON_ABOUT, LondonModalCoordinator} from '../src/helpers/london-modal-coordinator.mjs';

const mapSource = await readFile(new URL('../src/map.js', import.meta.url), 'utf8');
const cssSource = await readFile(new URL('../src/css/mini-tokyo-3d.css', import.meta.url), 'utf8');

function createElement(inert = false) {
    return {inert, isConnected: true};
}

function createCoordinator(background) {
    const events = [];
    const coordinator = new LondonModalCoordinator({
        getBackgroundTargets: () => background,
        onActivate: name => events.push(`activate:${name}`),
        onDeactivate: name => events.push(`deactivate:${name}`),
        onFocus: name => events.push(`focus:${name}`),
        onRestoreFocus: control => events.push(`restore:${control ? control.name : 'none'}`)
    });

    return {coordinator, events};
}

test('London About metadata distinguishes the fork from its upstream project', () => {
    assert.deepEqual(LONDON_ABOUT, {
        title: 'Mini London 3D',
        author: 'Long Hang Chung',
        sourceUrl: 'https://github.com/Zagitalc/mini-london-3d',
        upstreamTitle: 'Mini Tokyo 3D',
        upstreamUrl: 'https://github.com/nagix/mini-tokyo-3d'
    });
});

test('London About uses persistent dialog semantics and safe external links', () => {
    assert.match(mapSource, /id="london-about-dialog" class="london-about-dialog" role="dialog" aria-labelledby="london-about-title"/);
    assert.match(mapSource, /aria-label="About Mini London 3D" aria-haspopup="dialog" aria-controls="london-about-dialog"/);
    assert.match(mapSource, /target="_blank" rel="noopener noreferrer">Source code/);
    assert.match(mapSource, /target="_blank" rel="noopener noreferrer">Based on/);
    assert.match(cssSource, /\.mini-tokyo-3d\.is-london \.london-brand-button:focus-visible/);
    assert.match(cssSource, /\.mini-tokyo-3d\.is-london \.london-about-modal\.open/);
});

test('direct modal switching retains background inert ownership', () => {
    const background = [createElement(false), createElement(true)];
    const statusTrigger = {name: 'status', isConnected: true};
    const aboutTrigger = {name: 'about', isConnected: true};
    const {coordinator, events} = createCoordinator(background);

    assert.equal(coordinator.open('status', statusTrigger), true);
    assert.deepEqual(background.map(element => element.inert), [true, true]);
    assert.equal(coordinator.open('about', aboutTrigger), true);
    assert.deepEqual(events, [
        'activate:status',
        'focus:status',
        'deactivate:status',
        'activate:about',
        'focus:about'
    ]);
    assert.deepEqual(background.map(element => element.inert), [true, true]);
    assert.equal(coordinator.activeDialog, 'about');

    assert.equal(coordinator.close('about'), true);
    assert.deepEqual(background.map(element => element.inert), [false, true]);
    assert.equal(events.at(-1), 'restore:about');
});

test('closing is idempotent and a mismatched dialog cannot close the active dialog', () => {
    const {coordinator, events} = createCoordinator([createElement()]);

    coordinator.open('status', {name: 'status', isConnected: true});
    assert.equal(coordinator.close('about'), false);
    assert.equal(coordinator.isActive('status'), true);
    assert.equal(coordinator.close('status'), true);
    assert.equal(coordinator.close('status'), false);
    assert.equal(events.filter(event => event === 'deactivate:status').length, 1);
});

test('a recreated connected trigger replaces a disconnected invoking control', () => {
    const {coordinator, events} = createCoordinator([createElement()]);
    const oldTrigger = {name: 'old', isConnected: true};
    const newTrigger = {name: 'new', isConnected: true};

    coordinator.open('about', oldTrigger);
    oldTrigger.isConnected = false;
    coordinator.refreshInvokingControl('about', newTrigger);
    coordinator.close('about');

    assert.equal(events.at(-1), 'restore:new');
});
