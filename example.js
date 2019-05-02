const PSN = require('./index.js');
const api = new PSN;

const accessToken = {
    accessToken: null,
    get get() {
        return this.accessToken
    },
    set set(token) {
        this.accessToken = token;
    }
};

const uuid = "1cabd2cd-e704-442b-87d2-7a4222a45e04";
const tfa = "868174"


async function main() {
    try {
        const { access_token, refresh_token } = await api.getAcceeToken(uuid, tfa);
        console.log(access_token, refresh_token);
        accessToken.set = access_token;

        const profile = await api.getProfile("Hakoom", access_token);
        console.log(profile);

        console.log(accessToken.get);
    } catch (e) {
        console.log('error: ', e);
    }
}

main();