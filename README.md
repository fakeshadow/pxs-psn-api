# Example:

- You need access token to interact with PSN APIs. They can be obtained with a uuid and twoFA code. See [**HERE**](https://tusticles.com/psn-php/first_login.html) for detail how to get them

- chage your npsso in example.js and run
`node example.js`


```javascript
// import class
const PSN = require('./index.js');

// psn object accept optional params when construct.
const psn = new PSN({
    lang: "en",  //(default value en)
    region: "hk",  // server region(default value us)
    refresh_token: null, //refresh_token(default value null)
    access_token: null  //access_token(default value null)
});

const npsso = "put your npsso code here in string form";

async function main() {
    try {
        // access token is used to call other api, and refresh token is used to get new access_token when it's expired
        const { access_token, refresh_token } = await psn.auth(npsso);

        console.log(psn.access_token, psn.refresh_token);

        // get user profile with access_token
        const profile = await psn.getProfile("Hakoom");
        console.log(profile);

    } catch (e) {
        console.log('error: ', e);
    }
}

main();
 ```

```javascript
// other useful api calls

psn.searchGame(name, lang, region, age)   // find a named game from PSN store

psn.sendMessage(threadId, message, file_path)   // send a message to an PSN user(the target user must have a according privacy setting)

psn.getSummary(offset, onlineId) // get trophy summary of a given PSN user

 ```
