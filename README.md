# Example:

- You need access token to interact with PSN APIs. They can be obtained with a uuid and twoFA code. See [**HERE**](https://tusticles.com/psn-php/first_login.html) for detail how to get them

```javascript
// import as a class
const PSN = require('pxs-psn-api')
const api = new PSN

const uuid = 'uuid for login'
const tfa = 'two step code for login'

async function getProfile('PSN_USER_ID') {

    //return a promise contain accessToken which is needed to call other API endpoints
    const access_token = await api.getAcceeToken(uuid, tfa);

    //use the accessToken to get user profile 
    const profile = await api.getProfile('PSN_USER_ID', access_token)
    return profile
}
 ```

```javascript
// other useful api calls

api.searchGame(name, lang, region, age)   // find a named game from PSN store

api.sendMessage(threadId, message, content, access_token)   // send a message to an PSN user(the target user must have a according privacy setting)

api.getSummary(offset, onlineId, access_token) // get trophy summary of a given PSN user

 ```



- some feature are not working for now(mainly sending image message and get user activity)