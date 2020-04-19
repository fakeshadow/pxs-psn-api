'use strict'

const fs = require('fs').promises;
const qs = require('querystring');

const http = require('./http');
const fetch = require('node-fetch');
const formData = require('form-data-fork');

const urls = {
    AUTH_API: 'https://auth.api.sonyentertainmentnetwork.com/2.0/',

    USERS_API: '-prof.np.community.playstation.net/userProfile/v1/users/',
    USER_TROPHY_API: '-tpy.np.community.playstation.net/trophy/v1/trophyTitles/',
    MESSAGE_THREAD_API: '-gmsg.np.community.playstation.net/groupMessaging/v1/threads',

    STORE_API: 'https://store.playstation.com/valkyrie-api/',

    ACTIVITY_API: 'https://activity.api.np.km.playstation.net/activity/api/',

    CLIENT_ID: 'b7cbf451-6bb6-4a5a-8913-71e61f462787',
    CLIENT_SECRET: 'zsISsjmCx85zgCJg',
    DUID: '0000000d000400808F4B3AA3301B4945B2E3636E38C0DDFC',
    SCOPE: 'capone:report_submission,psn:sceapp,user:account.get,user:account.settings.privacy.get,user:account.settings.privacy.update,user:account.realName.get,user:account.realName.update,kamaji:get_account_hash,kamaji:ugc:distributor,oauth:manage_device_usercodes',
    REDIRECTURI: 'com.playstation.PlayStationApp://redirect',
}
// change log:
// use constructor on psn object. you can pass region(default US), language(default English) and refresh_token(default null) when build;
// getAccessToken method now return nothing when tokens are successfully got. you can use psn.refresh_token and psn.access_token to get them.
class PSN {
    // default language is English and server region is USA
    constructor({lang = "en", region = "us", access_token = null, refresh_token = null}) {
        this.lang = lang;
        this.region = region;
        this.refresh_token = refresh_token;
        this.access_token = access_token;
    }

    haveAccess() {
        if (this.access_token == null) {
            throw new Error("Unauthorized");
        }
    }

    // outdated authentication method
    // async auth(uuid, tfa) {
    //     const {npsso} = await getNpsso(uuid, tfa);
    //     const grantcode = await getGrant(npsso);
    //     let {access_token, refresh_token} = await getToken(grantcode);
    //     this.access_token = access_token;
    //     this.refresh_token = refresh_token;
    // }

    async auth(npsso) {
        const option = {
            url: `${urls.AUTH_API}oauth/token`,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': 'npsso=' + npsso,
            },
            body: qs.stringify({
                client_id: urls.CLIENT_ID,
                client_secret: urls.CLIENT_SECRET,
                scope: urls.SCOPE,
                grant_type: 'sso_cookie'
            })
        }

        let {access_token, refresh_token} = await http.post(option);
        this.access_token = access_token;
        this.refresh_token = refresh_token;
    }

    async getProfile(onlineId) {
        this.haveAccess();

        const option = {
            url: `https://${this.region}${urls.USERS_API}${onlineId}/profile?fields=%40default,relation,requestMessageFlag,presence,%40personalDetail,trophySummary`,
            auth: {
                'bearer': `${this.access_token}`
            }
        }
        return http.get(option);
    }

    async getIndividualGame(npCommunicationId, onlineId) {
        this.haveAccess();

        const option = {
            url: `https://${this.region}${urls.USER_TROPHY_API}${npCommunicationId}/trophyGroups/all/trophies?fields=%40default,trophyRare,trophyEarnedRate&npLanguage=${this.lang}&comparedUser=${onlineId}`,
            auth: {
                'bearer': `${this.access_token}`
            }
        }
        return http.get(option);
    }

    async getSummary(offset, onlineId) {
        this.haveAccess();
        const option = {
            url: `https://${this.region}${urls.USER_TROPHY_API}?fields=%40default&npLanguage=${this.lang}&iconSize=m&platform=PS3,PSVITA,PS4&offset=${offset}&limit=100&comparedUser=${onlineId}`,
            auth: {
                'bearer': `${this.access_token}`
            }
        }
        return http.get(option);
    }

    async getExistingMessageThreads(offset) {
        this.haveAccess();
        const option = {
            url: `https://${this.region}${urls.MESSAGE_THREAD_API}?offset=${offset}`,
            auth: {
                'bearer': `${this.access_token}`
            }
        };
        return http.get(option);
    }

    async getThreadDetail(threadId, count) {
        this.haveAccess();
        const option = {
            url: `https://${this.region}${urls.MESSAGE_THREAD_API}/${threadId}?fields=threadMembers,threadNameDetail,threadThumbnailDetail,threadProperty,latestTakedownEventDetail,newArrivalEventDetail,threadEvents&count=${count}`,
            auth: {
                'bearer': `${this.access_token}`
            }
        };
        return http.get(option)
    }

    async sendMessage(threadId, message, file_path) {
        this.haveAccess();

        const form = new formData();
        const body = {
            "messageEventDetail": {
                "eventCategoryCode": file_path != null ? 3 : 1,
                "messageDetail": {"body": message}
            }
        };

        form.append('messageEventDetail', JSON.stringify(body), {contentType: 'application/json; charset=utf-8'});

        if (file_path != null) {
            let f = await fs.readFile(file_path);
            form.append('imageData', f, {contentType: 'image/png', contentLength: f.length});
        }

        let res = await fetch(`https://${this.region}${urls.MESSAGE_THREAD_API}/${threadId}/messages`, {
            method: 'post',
            body: form,
            headers: {
                'Authorization': `Bearer ${this.access_token}`,
                'Content-Type': `multipart/form-data; boundary=${form._boundary}`,
            }
        });

        return res.json();
    }

    async generateNewMessageThread(onlineId, selfOnlineId) {
        this.haveAccess();

        const body = {"threadDetail": {"threadMembers": [{"onlineId": onlineId}, {"onlineId": selfOnlineId}]}}
        const form = new formData();
        form.append('threadDetail', JSON.stringify(body), {contentType: 'application/json; charset=utf-8'});
        const option = {
            url: `https://${this.region}${urls.MESSAGE_THREAD_API}/`,
            auth: {
                'bearer': `${this.access_token}`
            },
            headers: {
                'Content-Type': `multipart/form-data; boundary=${form._boundary}`,
            },
            body: form
        };
        return http.post(option);
    }

    async leaveMessageThread(threadId) {
        this.haveAccess();

        const option = {
            url: `https://${this.region}${urls.MESSAGE_THREAD_API}/${threadId}/users/me`,
            auth: {
                'bearer': `${this.access_token}`
            }
        }
        return http.del(option)
    }

    async getUserActivities(onlineId, type, page) {
        this.haveAccess();

        const body = {
            includeComments: true,
            offset: 0,
            blockSize: 10
        }
        const option = {
            url: `${urls.ACTIVITY_API}v1/users/${onlineId}/${type}/${page}?` + qs.stringify(body),
            auth: {
                'bearer': `${this.access_token}`
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            // body: qs.stringify({
            //     filters: PLAYED_GAME,
            //     filters: TROPHY,
            //     includeComments: false,
            //     offset: 1,
            //     blockSize: 5
            // }),
            gzip: true
        }
        return http.get(option)
    }

    static searchGame(name, lang, region, age) {
        const option = {
            url: `${urls.STORE_API}${lang}/${region}/${age}/tumbler-search/${name}?suggested_size=999&mode=game`
        }
        return http.get(option);
    }

    static showGameDetail(gameId, lang, region, age) {
        const option = {
            url: `${urls.STORE_API}${lang}/${region}/${age}/resolve/${gameId}`
        }
        return http.get(option);
    }

    async refreshAccessToken() {
        if (this.refresh_token == null) {
            throw new Error("no refresh_token found")
        }

        const option = {
            url: `${urls.AUTH_API}oauth/token`,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: qs.stringify({
                app_context: 'inapp_ios',
                client_id: urls.CLIENT_ID,
                client_secret: urls.CLIENT_SECRET,
                refresh_token: this.refresh_token,
                duid: urls.DUID,
                scope: urls.SCOPE,
                grant_type: 'refresh_token'
            })
        }
        let {access_token} = await http.post(option);
        this.access_token = access_token;
    }
}

module.exports = PSN;

// outdated along with old auth method
// const getToken = grantcode => {
//     const option = {
//         url: `${urls.AUTH_API}oauth/token`,
//         headers: {
//             'Content-Type': 'application/x-www-form-urlencoded',
//         },
//         body: qs.stringify({
//             client_id: urls.CLIENT_ID,
//             client_secret: urls.CLIENT_SECRET,
//             duid: urls.DUID,
//             scope: urls.SCOPE,
//             code: grantcode,
//             grant_type: 'authorization_code'
//         })
//     }
//     return http.post(option);
// }
//
// const getGrant = npsso => {
//     const option = {
//         url: `https://auth.api.sonyentertainmentnetwork.com/2.0/oauth/authorize?duid=0000000d000400808F4B3AA3301B4945B2E3636E38C0DDFC&app_context=inapp_ios&client_id=b7cbf451-6bb6-4a5a-8913-71e61f462787&scope=capone:report_submission,psn:sceapp,user:account.get,user:account.settings.privacy.get,user:account.settings.privacy.update,user:account.realName.get,user:account.realName.update,kamaji:get_account_hash,kamaji:ugc:distributor,oauth:manage_device_usercodes&response_type=code`,
//         headers: {
//             'Content-Type': 'application/x-www-form-urlencoded',
//             'Cookie': `npsso=${npsso}`
//         },
//         followRedirect: false
//     }
//
//     return http.getResponseHeader(option);
// }
//
// const getNpsso = (uuid, tfa) => {
//     const option = {
//         url: `${urls.AUTH_API}ssocookie`,
//         headers: {
//             'Content-Type': 'application/x-www-form-urlencoded',
//         },
//         body: qs.stringify({
//             authentication_type: 'two_step',
//             client_id: urls.CLIENT_ID,
//             ticket_uuid: uuid,
//             code: tfa
//         })
//     }
//     return http.post(option);
// }



