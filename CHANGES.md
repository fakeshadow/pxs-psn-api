# Change Log

## **[2.0.1] - 2020-04-20**

### Changed<br>
* Rename `PSN.refreshAccessToken` method to `PSN.refreshTokens`. It would update both `access_token` and `refresh_token` for your `PSN` instance.
* The old `refresh_token` will become invalid so be sure to store your latest `refresh_token` when you want to drop `PSN` object.

## **[2.0.0] - 2020-04-20**

### Changed<br>
* Use new method for first time authentication. examples and readme have been updated to reflect the change


## **[1.1.0] - 2019-08-13**

### Added<br>
* Add node-fetch as dep to reintroduce sending image messages.
* Use experimental fs.promises nodejs feature.<br>
### Changed<br>
* PSN object now use constructor. Accepts<br> 
```{lang: <psn response language>, region: <server region>, refresh_token:<refresh_token>, access_token:<access_token>}``` as optional params.
* SendMessage method accept local file path as arg instead of file buffer.
* Example has been updated according to these changes.