# Embedded node Configurator

Embedded Node Configurator is a crossplatform configuration tool for the system with embedded node protocol (ENP).

## Authors

Embedded Node Configurator is a [fork](#credits) of the Betaflight Configurator without MSP support.


## Native app build via NW.js

### Development

1. Install node.js
2. Change to project folder and run `npm install`.
3. Run `npm start`.

### Running tests

`npm test`

### App build and release

The tasks are defined in `gulpfile.js` and can be run either via `gulp <task-name>` (if the command is in PATH or via `../node_modules/gulp/bin/gulp.js <task-name>`:

1. Optional, install gulp `npm install --global gulp-cli`.
2. Run `gulp <taskname> [[platform] [platform] ...]`.

List of possible values of `<task-name>`:
* **dist** copies all the JS and CSS files in the `./dist` folder.
* **apps** builds the apps in the `./apps` folder [1].
* **debug** builds debug version of the apps in the `./debug` folder [1].
* **release** zips up the apps into individual archives in the `./release` folder [1]. 

[1] Running this task on macOS or Linux requires Wine, since it's needed to set the icon for the Windows app (build for specific platform to avoid errors).

#### Build or release app for one specific platform
To build or release only for one specific platform you can append the plaform after the `task-name`.
If no platform is provided, all the platforms will be done in sequence.

* **MacOS** use `gulp <task-name> --osx64`
* **Linux** use `gulp <task-name> --linux64`
* **Windows** use `gulp <task-name> --win32`

You can also use multiple platforms e.g. `gulp <taskname> --osx64 --linux64`.

## Notes

### Linux users

Dont forget to add your user into dialout group "sudo usermod -aG dialout YOUR_USERNAME" for serial access


### Issue trackers

For Embdedded node configurator issues raise them here

https://github.com/embnode/ENConfigurator/issues

For ENP library issues raise them here

https://github.com/embnode/enp/issues

## Technical details

The configurator is based on chrome.serial API running on Google Chrome/Chromium core.

## Developers

We accept clean and reasonable patches, submit them!
