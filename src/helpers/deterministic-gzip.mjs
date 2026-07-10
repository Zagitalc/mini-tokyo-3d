import zlib from 'zlib';

export const GZIP_OPTIONS = Object.freeze({
    level: 9,
    mtime: 0
});

export function gzipJSON(data) {
    return new Promise((resolve, reject) => {
        zlib.gzip(JSON.stringify(data), GZIP_OPTIONS, (error, result) => {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
}
