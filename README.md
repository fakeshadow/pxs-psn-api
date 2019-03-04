# Example:

- You need access token to interact with PSN APIs. They can be obtained with a uuid and twoFA code. See [**HERE**](https://tusticles.com/psn-php/first_login.html) for detail how to get them

```javascript
// import as a class
const PSN = require('pxs-psn-api')
const api = new PSN

const uuid = 'uuid for login'
const tfa = 'two step code for login'

// return a promise contain access_token and refresh_token. 
const { access_token, refresh_token } = await api.getAcceeToken(uuid, tfa);

// access_token is used to call other APIs and refresh_token is used to get new access_token when it's expired.
const tokenNew = await api.refreshAccessToken(refresh_token);

//use the accessToken to get user profile 
const profile = await api.getProfile('PSN_USER_ID', access_token);

```


```javascript
// other useful api calls

api.searchGame(name, lang, region, age)   // find a named game from PSN store

api.sendMessage(threadId, message, content, access_token)   // send a message to a PSN user(the target user must have a according privacy setting). content accept buffer of image file. max size is 1mb

api.getSummary(offset, onlineId, access_token) // get trophy summary of a given PSN user. offset starts from 0.

api.getIndividualGame(npCommunicationId, onlineId, access_token) //get trophies by gameId. 

 ```


- get user activity doesn not work for now