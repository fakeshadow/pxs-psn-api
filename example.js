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
        await psn.refreshAccessToken();
    } catch (e) {
        console.log('error: ', e);
        console.log("Trying to login with npsso code");
        await psn.auth(npsso);
    }

    if (psn.access_token == null) {
        console.log("Authentication failed. Please check your npsso code if the network to PSN is Ok");
        return;
    }

    console.log(`Authentication Success, You npsso code is consumed in the auth progress and can't be used again. If you want to login in with npsso next time be sure to get a new one`);

    try {
        let profile = await psn.getProfile("Hakoom");
        console.log(profile);

        let summary = await psn.getSummary(0, "Hakoom");
        console.log(summary);

        let individual = await psn.getIndividualGame("NPWR10788_00", "Hakoom");
        console.log(individual);

        let messages = await psn.getExistingMessageThreads(0);
        console.log(messages);

        if (messages.threads.length > 0) {
            let thread_id = messages.threads[0].threadId;
            let message = await psn.getThreadDetail(thread_id, 100);
            console.log(message);
        }

        console.log("psn object holds tokens that are needed for future use , it's best to store them locally before drop the object");
        console.log(`Your access_token: ${psn.access_token}  //<- You need this to call most APIs`);
        console.log(`Your refresh_token: ${psn.refresh_token} //<- You need this to generate new access_token as the latter only last an hour before it expire.`);
        console.log("Example finish successfully.")
    } catch (e) {
        console.log(`error: ${e}`)
        console.log(`Something went wrong in one of the API endpoint test. You can try to restart the example with your newly obtained refresh_token: ${psn.refresh_token}`);
    }
}

main();