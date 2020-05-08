'use strict'

const fs = require('fs').promises;

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

    CLIENT_ID: "7c01ce37-cb6b-4938-9c1b-9e36fd5477fa",
    CLIENT_SECRET: "GNumO5QMsagNcO2q",
    DUID: "00000007000801a8000000000000008241fdf6ab09ba863a20202020476f6f676c653a416e64726f696420534400000000000000000000000000000000",
    SCOPE: "kamaji:get_players_met+kamaji:get_account_hash+kamaji:activity_feed_submit_feed_story+kamaji:activity_feed_internal_feed_submit_story+kamaji:activity_feed_get_news_feed+kamaji:communities+kamaji:game_list+kamaji:ugc:distributor+oauth:manage_device_usercodes+psn:sceapp+user:account.profile.get+user:account.attributes.validate+user:account.settings.privacy.get+kamaji:activity_feed_set_feed_privacy+kamaji:satchel+kamaji:satchel_delete+user:account.profile.update+kamaji:url_preview",

    // backup
    // CLIENT_ID: 'b7cbf451-6bb6-4a5a-8913-71e61f462787',
    // CLIENT_SECRET: 'zsISsjmCx85zgCJg',
    // DUID: '0000000d000400808F4B3AA3301B4945B2E3636E38C0DDFC',
    // SCOPE: 'capone:report_submission,psn:sceapp,user:account.get,user:account.settings.privacy.get,user:account.settings.privacy.update,user:account.realName.get,user:account.realName.update,kamaji:get_account_hash,kamaji:ugc:distributor,oauth:manage_device_usercodes',
    // REDIRECTURI: 'com.playstation.PlayStationApp://redirect',
}

class PSN {
    // default language is English and server region is USA
    constructor({ lang = "en", region = "us", access_token = null, refresh_token = null }) {
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

    async auth(npsso) {
        const option = {
            url: `${urls.AUTH_API}oauth/token`,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': 'npsso=' + npsso,
            },
            body: `client_id=${urls.CLIENT_ID}&client_secret=${urls.CLIENT_SECRET}&scope=${urls.SCOPE}&grant_type=sso_cookie`,
        }

        const { access_token, refresh_token } = await http.post(option);
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
                "messageDetail": { "body": message }
            }
        };

        form.append('messageEventDetail', JSON.stringify(body), { contentType: 'application/json; charset=utf-8' });

        if (file_path != null) {
            let f = await fs.readFile(file_path);
            form.append('imageData', f, { contentType: 'image/png', contentLength: f.length });
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

        const body = { "threadDetail": { "threadMembers": [{ "onlineId": onlineId }, { "onlineId": selfOnlineId }] } }
        const form = new formData();
        form.append('threadDetail', JSON.stringify(body), { contentType: 'application/json; charset=utf-8' });
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

    async refreshTokens() {
        if (this.refresh_token == null) {
            throw new Error("no refresh_token found")
        }

        const option = {
            url: `${urls.AUTH_API}oauth/token`,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `app_context=inapp_ios&client_id=${urls.CLIENT_ID}&client_secret=${urls.CLIENT_SECRET}&refresh_token=${this.refresh_token}&duid=${urls.DUID}&scope=${urls.SCOPE}&grant_type=refresh_token`,
        }
        let { access_token, refresh_token } = await http.post(option);
        this.access_token = access_token;
        this.refresh_token = refresh_token;
    }
}

module.exports = PSN;



