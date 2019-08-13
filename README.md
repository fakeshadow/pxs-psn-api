# Example:

- You need access token to interact with PSN APIs. They can be obtained with a uuid and twoFA code. See [**HERE**](https://tusticles.com/psn-php/first_login.html) for detail how to get them

- chage your uuid and tfa in example.js and run
`node example.js`


```javascript
// import class
const PSN = require('./index.js');
const api = new PSN;

// store your tokens in getter or you could store them in files
const accessToken = {
    accessToken: null,
    get access() {
        return this.accessToken
    },
    set set(token) {
        this.accessToken = token;
    }
};

const uuid = "your uuid";
const tfa = "your 2fa code";

async function main() {
    try {
        // access code is used to call other api, and refresh code is used to get new access_token when it's expired
        const { access_token, refresh_token } = await api.getAcceeToken(uuid, tfa);

        console.log(access_token, refresh_token);
        accessToken.set = access_token;

        // get user profile with access_token
        const profile = await api.getProfile("Hakoom", access_token);
        console.log(profile);

        console.log(accessToken.get);
    } catch (e) {
        console.log('error: ', e);
    }
}

main();
 ```

```javascript
// other useful api calls

PSN.searchGame(name, lang, region, age)   // find a named game from PSN store

api.sendMessage(threadId, message, content, access_token)   // send a message to an PSN user(the target user must have a according privacy setting)

api.getSummary(offset, onlineId, access_token) // get trophy summary of a given PSN user

 ```


- some feature are not working for now(mainly sending image message and get user activity)