'use strict'

const qs = require('querystring');
const formData = require('form-data-fork')
const fetch = require('node-fetch')

/*  backup credential  

const urls = {
    AUTH_API: 'https://auth.api.sonyentertainmentnetwork.com/2.0/',
    USERS_API: 'https://hk-prof.np.community.playstation.net/userProfile/v1/users/',
    USER_TROPHY_API: 'https://hk-tpy.np.community.playstation.net/trophy/v1/trophyTitles',
    ACTIVITY_API: 'https://activity.api.np.km.playstation.net/activity/api/',

    MESSAGE_THREAD_API: 'https://hk-gmsg.np.community.playstation.net/groupMessaging/v1/',
    STORE_API: 'https://store.playstation.com/valkyrie-api/',

    CLIENT_ID: 'b7cbf451-6bb6-4a5a-8913-71e61f462787',
    CLIENT_SECRET: 'zsISsjmCx85zgCJg',
    DUID: '0000000d000400808F4B3AA3301B4945B2E3636E38C0DDFC',
    SCOPE: 'capone:report_submission,psn:sceapp,user:account.get,user:account.settings.privacy.get,user:account.settings.privacy.update,user:account.realName.get,user:account.realName.update,kamaji:get_account_hash,kamaji:ugc:distributor,oauth:manage_device_usercodes',
    REDIRECTURI: 'com.playstation.PlayStationApp://redirect',

} */

// change hk to your region maybe result in a faster query speed
const urls = {
    AUTH_API: 'https://auth.api.sonyentertainmentnetwork.com/2.0/',
    USERS_API: 'https://hk-prof.np.community.playstation.net/userProfile/v1/users/',
    USER_TROPHY_API: 'https://hk-tpy.np.community.playstation.net/trophy/v1/trophyTitles',
    ACTIVITY_API: 'https://activity.api.np.km.playstation.net/activity/api/',

    MESSAGE_THREAD_API: 'https://hk-gmsg.np.community.playstation.net/groupMessaging/v1/',
    STORE_API: 'https://store.playstation.com/valkyrie-api/',

    CLIENT_ID: 'ebee17ac-99fd-487c-9b1e-18ef50c39ab5',
    CLIENT_SECRET: 'e4Ru_s*LrL4_B2BD',
    DUID: '0000000d00040080027BC1C3FBB84112BFC9A4300A78E96A',
    SCOPE: 'kamaji:get_players_met kamaji:get_account_hash kamaji:activity_feed_submit_feed_story kamaji:activity_feed_internal_feed_submit_story kamaji:activity_feed_get_news_feed kamaji:communities kamaji:game_list kamaji:ugc:distributor oauth:manage_device_usercodes psn:sceapp user:account.profile.get user:account.attributes.validate user:account.settings.privacy.get kamaji:activity_feed_set_feed_privacy kamaji:satchel kamaji:satchel_delete user:account.profile.update',
    REDIRECTURI: 'com.playstation.PlayStationApp://redirect',
}

class PSN {
    async getAcceeToken(uuid, tfa) {
        const { npsso } = await getNpsso(uuid, tfa);
        const grantcode = await getGrant(npsso);
        return getToken(grantcode);
    }

    getProfile(onlineId, access_token) {
        const fields = {
            'fields': '@default,relation,requestMessageFlag,presence,@personalDetail,trophySummary',
        }
        const url = `${urls.USERS_API}${onlineId}/profile?` + qs.stringify(fields);
        const option = {
            method: 'GET',
            headers: {
                'Authorization': 'bearer ' + access_token
            }
        }
        return fetch(url, option).then(res => res.json())
    }

    getIndividualGame(npCommunicationId, onlineId, access_token) {
        const fields = {
            'fields': '@default,trophyRare,trophyEarnedRate',
            'npLanguage': 'en',
            'comparedUser': onlineId
        }

        const url = `${urls.USER_TROPHY_API}/${npCommunicationId}/trophyGroups/all/trophies?` + qs.stringify(fields);
        const option = {
            method: 'GET',
            headers: {
                'Authorization': 'bearer ' + access_token
            }
        }
        return fetch(url, option).then(res => res.json())
    }

    getSummary(offset, onlineId, access_token) {
        const fields = {
            'fields': '@default',
            'npLanguage': 'en',
            'iconSize': 'm',
            'platform': 'PS3,PSVITA,PS4',
            'offset': offset,
            'limit': 100,
            'comparedUser': onlineId
        }
        const url = `${urls.USER_TROPHY_API}?` + qs.stringify(fields);
        const option = {
            method: 'GET',
            headers: {
                'Authorization': 'bearer ' + access_token
            }
        }
        return fetch(url, option).then(res => res.json())
    }

    getExistingMessageThreads(access_token) {
        const url = `${urls.MESSAGE_THREAD_API}threads/`;
        const option = {
            method: 'GET',
            headers: {
                'Authorization': 'bearer ' + access_token
            }
        }
        return fetch(url, option).then(res => res.json())
    }

    getThreadDetail(threadId, count, access_token) {
        const field = {
            'fields': 'threadMembers,threadNameDetail,threadThumbnailDetail,threadProperty,latestTakedownEventDetail,newArrivalEventDetail,threadEvents',
            'count': count //show upto 100 recent messages from one thread
        }
        const url = `${urls.MESSAGE_THREAD_API}threads/${threadId}?` + qs.stringify(field);
        const option = {
            method: 'GET',
            headers: {
                'Authorization': 'bearer ' + access_token
            }
        }
        return fetch(url, option).then(res => res.json())
    }

    sendMessage(threadId, message, content, access_token) {
        if (content) return sendImage(threadId, message, content, access_token);
        if (message && !content) return sendText(threadId, message, access_token);
        return null;
    }

    generateNewMessageThread(onlineId, selfOnlineId, access_token) {
        const body = { "threadDetail": { "threadMembers": [{ "onlineId": onlineId }, { "onlineId": selfOnlineId }] } }
        const form = new formData();
        form.append('threadDetail', JSON.stringify(body), { contentType: 'application/json; charset=utf-8' });

        const header = form.getHeaders();
        const url = `${urls.MESSAGE_THREAD_API}threads/`;
        const option = {
            method: 'POST',
            body: form,
            headers: {
                'Authorization': 'bearer ' + access_token,
                'Content-Type': header['content-type']
            }
        }
        return fetch(url, option).then(res => res.json())
    }

    leaveMessageThread(threadId, access_token) {
        const url = `${urls.MESSAGE_THREAD_API}threads/${threadId}/users/me`;
        const option = {
            method: 'DELETE',
            headers: {
                'Authorization': 'bearer ' + access_token
            }
        }
        return fetch(url, option);
    }

    getUserActivities(onlineId, type, page, access_token) {
        const body = {
            includeComments: true,
            offset: 0,
            blockSize: 10
        }
        const url = `${urls.ACTIVITY_API}v2/users/${onlineId}/${type}/${page}?` + qs.stringify(body);
        console.log('from pxs:' + url)
        const option = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'bearer ' + access_token
            },
            compress: true,
        }
        return fetch(url, option).then(res => res.json())
    }

    searchGame(name, lang, region, age) {
        const url = `${urls.STORE_API}${lang}/${region}/${age}/tumbler-search/${name}?suggested_size=999&mode=game`;
        const option = {
            method: 'GET'
        }
        return fetch(url, option).then(res => res.json())
    }

    async showGameDetail(gameId, lang, region, age) {
        const url = `${urls.STORE_API}${lang}/${region}/${age}/resolve/${gameId}`;
        const option = {
            method: 'GET'
        }
        return fetch(url, option).then(res => res.json())
    }

    refreshAccessToken(refreshToken) {
        const url = `${urls.AUTH_API}oauth/token`;
        const option = {
            method: 'POST',
            body: qs.stringify({
                app_context: 'inapp_ios',
                client_id: urls.CLIENT_ID,
                client_secret: urls.CLIENT_SECRET,
                refresh_token: refreshToken,
                duid: urls.DUID,
                scope: urls.SCOPE,
                grant_type: 'refresh_token'
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
        return fetch(url, option).then(res => res.json())
    }
}

module.exports = PSN;


//helper functions
const getToken = grantcode => {
    const url = `${urls.AUTH_API}oauth/token`;
    const option = {
        method: 'POST',
        body: qs.stringify({
            client_id: urls.CLIENT_ID,
            client_secret: urls.CLIENT_SECRET,
            duid: urls.DUID,
            scope: urls.SCOPE,
            code: grantcode,
            grant_type: 'authorization_code',
            redirect_uri: urls.REDIRECTURI
        }),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    }
    return fetch(url, option).then(res => res.json())
}

const getGrant = npsso => {
    const code_request = {
        duid: urls.DUID,
        app_context: "inapp_ios",
        client_id: urls.CLIENT_ID,
        scope: urls.SCOPE,
        response_type: "code",
        redirect_uri: urls.REDIRECTURI
    }
    const url = `${urls.AUTH_API}oauth/authorize?` + qs.stringify(code_request);
    const option = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': `npsso=${npsso}`
        },
        redirect: 'manual',
        follow: '0'
    }
    return fetch(url, option).then(res => res.headers.get('x-np-grant-code'))
}

const getNpsso = (uuid, tfa) => {
    const url = `${urls.AUTH_API}ssocookie`;
    const option = {
        method: 'POST',
        body: qs.stringify({
            authentication_type: 'two_step',
            client_id: urls.CLIENT_ID,
            ticket_uuid: uuid,
            code: tfa
        }),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    }
    return fetch(url, option).then(res => res.json())
}

const sendText = (threadId, message, access_token) => {
    const body = { "messageEventDetail": { "eventCategoryCode": 1, "messageDetail": { "body": message } } }
    const form = new formData();

    form.append('messageEventDetail', JSON.stringify(body), { contentType: 'application/json; charset=utf-8' });

    const header = form.getHeaders();
    const url = `${urls.MESSAGE_THREAD_API}threads/${threadId}/messages`;
    const option = {
        method: 'POST',
        body: form,
        headers: {
            'Authorization': 'bearer ' + access_token,
            'Content-Type': header['content-type']
        }
    }
    return fetch(url, option).then(res => res.json())
}

const sendImage = (threadId, message, content, access_token) => {
    const body = { "messageEventDetail": { "eventCategoryCode": 3, "messageDetail": { "body": message } } }
    const form = new formData();

    form.append('messageEventDetail', JSON.stringify(body), { contentType: 'application/json; charset=utf-8' });
    form.append('imageData', content, { contentType: 'image/png', contentLength: content.length });

    const header = form.getHeaders();
    const url = `${urls.MESSAGE_THREAD_API}threads/${threadId}/messages`;
    const option = {
        method: 'POST',
        body: form,
        headers: {
            'Authorization': 'bearer ' + access_token,
            'Content-Type': header['content-type']
        }
    }
    return fetch(url, option).then(res => res.json())
}