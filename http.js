'use strict'

const request = require('request')

function post(option) {
    return new Promise((resolve, reject) => {
        request.post(option, (err, response, body) => {
            const parsedBody = JSON.parse(body);
            if (parsedBody.error) return reject(parsedBody.error);
            if (err) return reject(err);
            resolve(parsedBody);
        })
    })
}

function get(option) {
    return new Promise((resolve, reject) => {
        request.get(option, (err, response, body) => {
            const parsedBody = JSON.parse(body);
            if (parsedBody.error) return reject(parsedBody.error);
            if (err) return reject(err);
            resolve(parsedBody);
        })
    })
}

function getResponseHeader(option) {
    return new Promise((resolve, reject) => {
        request.get(option, (err, response, body) => {
            const parsedBody = JSON.parse(body);
            if (parsedBody.error) return reject(parsedBody.error);
            if (err) return reject(err);
            resolve(response.headers['x-np-grant-code']);
        })
    })
}

function del(option) {
    return new Promise((resolve, reject) => {
        request.delete(option, (err, response, body) => {
            if (err) return reject(err);
            resolve('success');
        })
    })
}

module.exports = {
    post,
    get,
    del,
    getResponseHeader
};