import fs from 'fs';
import https from 'https';
import {gzipJSON} from '../helpers/deterministic-gzip.mjs';

export function loadJSON(url) {
    return new Promise((resolve, reject) => {
        if (url.startsWith('https')) {
            https.get(url, {
                headers: {
                    'User-Agent': 'MiniTokyo3DLoader/0.0'
                }
            }, res => {
                let body = '';

                res.setEncoding('utf8');
                res.on('data', chunk => {
                    body += chunk;
                });
                res.on('end', () => resolve(JSON.parse(body)));
            }).on('error', error => reject(error));
        } else {
            fs.promises.readFile(url).then(
                data => resolve(JSON.parse(data))
            ).catch(
                error => reject(error)
            );
        }
    });
}

export function saveJSON(path, data) {
    return gzipJSON(data).then(result => fs.promises.writeFile(path, result));
}

export function readdir(path) {
    return fs.promises.readdir(path);
}

export function buildLookup(array) {
    const lookup = {};

    for (const element of array) {
        lookup[element.id] = element;
    }
    return lookup;
}
