/*  Commuter Bliss UK - a Pebble watchface for UK rail commuters
    Copyright (C) 2015 Steven Blair

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program. If not, see <http://www.gnu.org/licenses/>. */


// customisable options
var HOME_STATION = null;
var WORK_STATION = null;
var useLocation = null;
var customisedDays = null;
var use_monday = null;
var use_tuesday = null;
var use_wednesday = null;
var use_thursday = null;
var use_friday = null;
var use_saturday = null;
var use_sunday = null;
var customisedTimes = null;
var morning_start = null;
var morning_end = null;
var afternoon_start = null;
var afternoon_end = null;
var use_HTTPS = null;
var check_time = null;
var update_only_on_tap = null;

// constants
var NUMBER_OF_TRAINS = 3;
var LOCATION_TIMEOUT= 8000;
var LOCATION_MAXIMUM_AGE = 0;

// globals
var current_origin = HOME_STATION;
var current_destination = WORK_STATION;
var stations_tree = null;
var time_diff_ms = 0;


var xhrRequest = function(url, type, callback, error) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function () {
        callback(this.responseText);
    };
    if (error !== undefined) {
        xhr.onerror = function() {
            error();
        };
    }
    xhr.open(type, url);
    xhr.send();
};

function parseLocalStorage(type) {
    // additional code required to deal with strange Python-style 'True' and 'False' when using emulator
    if (typeof type == 'string' && type === 'False') {
        return JSON.parse('false');
    }
    else if (typeof type == 'string' && type === 'True') {
        return JSON.parse('true');
    }
    
    return typeof type == 'string' ? JSON.parse(type) : type;
}

function getNearestStation(lat, lon) {
    var nearestNeighbour = stations_tree.getNearestNeighbour({x: lat, y: lon});
    
    if (nearestNeighbour) {
        return nearestNeighbour.CRS;
    }
    
    return null;
}

function locationSuccess(pos) {
    current_origin = getNearestStation(pos.coords.latitude, pos.coords.longitude);
//     console.log('current_origin: ' + current_origin);
    
    // fall back to time-based origin and destination
    if (current_origin === null) {
        locationError(null);
        return;
    }

//     // assume that only one station maps to home station; for all other stations, calculate route home
//     if (current_origin == HOME_STATION) {
//         current_destination = WORK_STATION;
//     } else {
//         current_destination = HOME_STATION;
//     }
    
    if ((new Date()).getHours() >= 12 || (new Date()).getHours() < 3) {
        current_destination = HOME_STATION;
    } else {
        current_destination = WORK_STATION;
    }
    
    // the closest station is the destination; reset train data
    if (current_origin === current_destination) {
        var dictionary = {
            'KEY_UPDATE': 0,
            'KEY_CURRENT_ORIGIN': current_origin,
            'KEY_CURRENT_DESTINATION': current_destination,
            'KEY_TRAIN1_TIME': 0,
            'KEY_TRAIN1_DEST': '',
            'KEY_TRAIN1_PLATFORM': 0,
            'KEY_TRAIN2_TIME': 0,
            'KEY_TRAIN3_TIME': 0,
            'KEY_TRAIN1_IS_CANCELED': 0,
            'KEY_TRAIN2_IS_CANCELED': 0,
            'KEY_TRAIN3_IS_CANCELED': 0,
            'KEY_LAST_REQUEST_FAILED': 0
        };
        Pebble.sendAppMessage(dictionary, function (e) {}, function (e) {});
        return;
    }

    getTrains();
}

function locationError(err) {
    if ((new Date()).getHours() >= 12 || (new Date()).getHours() < 3) {
        current_origin = WORK_STATION;
        current_destination = HOME_STATION;
    } else {
        current_origin = HOME_STATION;
        current_destination = WORK_STATION;
    }

    getTrains();
}

function getLocation() {
    navigator.geolocation.getCurrentPosition(
        locationSuccess, locationError, {
            enableHighAccuracy: true,
            timeout: LOCATION_TIMEOUT,
            maximumAge: LOCATION_MAXIMUM_AGE
        }
    );
}

function getTrains() {
    var now = new Date();
    now.setSeconds(0, 0);

    var protocol = 'http';
    if (use_HTTPS === true) {
        protocol = 'https';
    }
    var URL = protocol + '://commuter-bliss-uk.apphb.com/departures/' + current_origin + '/to/' + current_destination + '/' + NUMBER_OF_TRAINS;

    xhrRequest(URL, 'GET', function (responseText) {
        var json = JSON.parse(responseText);

        // assemble dictionary from keys
        var dictionary = {
            'KEY_UPDATE': 0,
            'KEY_CURRENT_ORIGIN': current_origin,
            'KEY_CURRENT_DESTINATION': current_destination,
            'KEY_TRAIN1_TIME': 0,
            'KEY_TRAIN1_DEST': '',
            'KEY_TRAIN1_PLATFORM': 0,
            'KEY_TRAIN2_TIME': 0,
            'KEY_TRAIN3_TIME': 0,
            'KEY_TRAIN1_IS_CANCELED': 0,
            'CUSTOMISED_DAYS': customisedDays,
            'USE_MONDAY': use_monday,
            'USE_TUESDAY': use_tuesday,
            'USE_WEDNESDAY': use_wednesday,
            'USE_THURSDAY': use_thursday,
            'USE_FRIDAY': use_friday,
            'USE_SATURDAY': use_saturday,
            'USE_SUNDAY': use_sunday,
            'CUSTOMISED_TIMES': customisedTimes,
            'MORNING_START': parseInt(morning_start),
            'MORNING_END': parseInt(morning_end),
            'AFTERNOON_START': parseInt(afternoon_start),
            'AFTERNOON_END': parseInt(afternoon_end),
            'KEY_TRAIN2_IS_CANCELED': 0,
            'KEY_TRAIN3_IS_CANCELED': 0,
            'TIME_DIFF_FROM_UTC': time_diff_ms,
            'KEY_LAST_REQUEST_FAILED': 0,
            'KEY_UPDATE_ONLY_ON_TAP': update_only_on_tap
        };

        if (json.trainServices) {
            var trains = [];
            var trainsLen = json.trainServices.length;

            for (var i = 0; i < trainsLen; i++) {
                trains.push(json.trainServices[i].std);

                var trainTime = new Date(now.getTime());
                var trainTimeTextArray = '';
                var cancelled = false;
                
                // check for known delays in 'etd' field
//                 console.log('etd: ' + json.trainServices[i].etd + ', std: ' + json.trainServices[i].std);
                if (json.trainServices[i].etd !== null) {
                    if (json.trainServices[i].etd.indexOf(':') > -1) {
                        trainTimeTextArray = json.trainServices[i].etd.split(':');
                    }
                    else if (json.trainServices[i].etd == 'Cancelled') {
                        cancelled = true;
                        trainTimeTextArray = json.trainServices[i].std.split(':');
                    }
                    else if (json.trainServices[i].etd == 'Delayed') {
                        trainTimeTextArray = json.trainServices[i].std.split(':');
                    }
                    else if (json.trainServices[i].etd == 'On time') {
                        trainTimeTextArray = json.trainServices[i].std.split(':');
                    }
                    else {
                        trainTimeTextArray = json.trainServices[i].std.split(':');
                    }
                }
                else {
                    trainTimeTextArray = json.trainServices[i].std.split(':');
                }
                trainTime.setHours(trainTimeTextArray[0]);
                trainTime.setMinutes(trainTimeTextArray[1]);
                trainTime.setSeconds(0);

//                 // cater for departures in early hours of following day
                if (trainTime.getHours() >= 0 && trainTime.getHours() <= 3) {
                    trainTime.setDate(trainTime.getDate() + 1);
                }

                if (i === 0) {
                    if (cancelled) {
                        dictionary.KEY_TRAIN1_IS_CANCELED = 1;
                    }
                    dictionary.KEY_TRAIN1_TIME = trainTime.getTime() / 1000;
                    dictionary.KEY_TRAIN1_DEST = json.trainServices[i].destination[0].crs;

                    var platform = -1;
                    if (json.trainServices[i].platform) {
                        platform = parseInt(json.trainServices[i].platform);
                    }
                    dictionary.KEY_TRAIN1_PLATFORM = platform;
                } else if (i === 1) {
                    if (cancelled) {
                        dictionary.KEY_TRAIN2_IS_CANCELED = 1;
                    }
                    dictionary.KEY_TRAIN2_TIME = trainTime.getTime() / 1000;
                    dictionary.KEY_TRAIN2_DEST = json.trainServices[i].destination[0].crs;
                } else if (i === 2) {
                    if (cancelled) {
                        dictionary.KEY_TRAIN3_IS_CANCELED = 1;
                    }
                    dictionary.KEY_TRAIN3_TIME = trainTime.getTime() / 1000;
                    dictionary.KEY_TRAIN3_DEST = json.trainServices[i].destination[0].crs;
                }
            }
        }
//         else {
//             console.log('no trains');
//         }
        
        if (check_time) {
            xhrRequest('http://www.timeapi.org/utc/now', 'GET', function (responseText) {
                var local_date = new Date();
                var remote_date = new Date(responseText);
                time_diff_ms = remote_date - local_date;    // this is the amount to add to the local time to correct it
                
                dictionary.TIME_DIFF_FROM_UTC = time_diff_ms;
                
                // send to Pebble
                Pebble.sendAppMessage(dictionary, function (e) {}, function (e) {});
            });
        }
        else {
            // send to Pebble
            Pebble.sendAppMessage(dictionary, function (e) {
    //             console.log('Data sent to Pebble successfully!');
            }, function (e) {
    //             console.log('Error sending data to Pebble!');
            });
        }
    }, function() {
        console.log('XHR failed');
        
        var dictionary = {
            'KEY_LAST_REQUEST_FAILED': 1
        };
        Pebble.sendAppMessage(dictionary, function (e) {}, function (e) {});
    });
}

function getConfigFromLocalStorage() {
    HOME_STATION = localStorage.getItem('home');
    if (HOME_STATION === null) {
        HOME_STATION = 'GLC';
    }
    
    WORK_STATION = localStorage.getItem('work');
    if (WORK_STATION === null) {
        WORK_STATION = 'EDB';
    }
    
    useLocation = localStorage.getItem('useLocation');
    if (useLocation === null) {
        useLocation = true;
    }
    else {
        useLocation = parseLocalStorage(localStorage.getItem('useLocation'));
    }
    
    customisedDays = localStorage.getItem('customisedDays');
    if (customisedDays === null) {
        customisedDays = false;
    }
    else {
        customisedDays = parseLocalStorage(localStorage.getItem('customisedDays'));
    }
    use_monday = localStorage.getItem('use_monday');
    if (use_monday === null) {
        use_monday = true;
    }
    else {
        use_monday = parseLocalStorage(localStorage.getItem('use_monday'));
    }
    use_tuesday = localStorage.getItem('use_tuesday');
    if (use_tuesday === null) {
        use_tuesday = true;
    }
    else {
        use_tuesday = parseLocalStorage(localStorage.getItem('use_tuesday'));
    }
    use_wednesday = localStorage.getItem('use_wednesday');
    if (use_wednesday === null) {
        use_wednesday = true;
    }
    else {
        use_wednesday = parseLocalStorage(localStorage.getItem('use_wednesday'));
    }
    use_thursday = localStorage.getItem('use_thursday');
    if (use_thursday === null) {
        use_thursday = true;
    }
    else {
        use_thursday = parseLocalStorage(localStorage.getItem('use_thursday'));
    }
    use_friday = localStorage.getItem('use_friday');
    if (use_friday === null) {
        use_friday = true;
    }
    else {
        use_friday = parseLocalStorage(localStorage.getItem('use_friday'));
    }
    use_saturday = localStorage.getItem('use_saturday');
    if (use_saturday === null) {
        use_saturday = true;
    }
    else {
        use_saturday = parseLocalStorage(localStorage.getItem('use_saturday'));
    }
    use_sunday = localStorage.getItem('use_sunday');
    if (use_sunday === null) {
        use_sunday = true;
    }
    else {
        use_sunday = parseLocalStorage(localStorage.getItem('use_sunday'));
    }
    
    customisedTimes = localStorage.getItem('customisedTimes');
    if (customisedTimes === null) {
        customisedTimes = false;
    }
    else {
        customisedTimes = parseLocalStorage(localStorage.getItem('customisedTimes'));
    }
    morning_start = localStorage.getItem('morning_start');
    if (morning_start === null) {
        morning_start = 7;
    }
    else {
        morning_start = localStorage.getItem('morning_start');
    }
    morning_end = localStorage.getItem('morning_end');
    if (morning_end === null) {
        morning_end = 11;
    }
    else {
        morning_end = localStorage.getItem('morning_end');
    }
    afternoon_start = localStorage.getItem('afternoon_start');
    if (afternoon_start === null) {
        afternoon_start = 16;
    }
    else {
        afternoon_start = localStorage.getItem('afternoon_start');
    }
    afternoon_end = localStorage.getItem('afternoon_end');
    if (afternoon_end === null) {
        afternoon_end = 20;
    }
    else {
        afternoon_end = localStorage.getItem('afternoon_end');
    }
    
    use_HTTPS = localStorage.getItem('use_HTTPS');
    if (use_HTTPS === null) {
        use_HTTPS = false;
    }
    else {
        use_HTTPS = parseLocalStorage(localStorage.getItem('use_HTTPS'));
    }
    
    check_time = localStorage.getItem('check_time');
    if (check_time === null) {
        check_time = false;
    }
    else {
        check_time = parseLocalStorage(localStorage.getItem('check_time'));
    }
    
    update_only_on_tap = localStorage.getItem('update_only_on_tap');
    if (update_only_on_tap === null) {
        update_only_on_tap = false;
    }
    else {
        update_only_on_tap = parseLocalStorage(localStorage.getItem('update_only_on_tap'));
    }
    
//     console.log('configured stations: ' + HOME_STATION + ', ' + WORK_STATION);
//     console.log('configured useLocation: ' + useLocation);
//     console.log('customisedDays: ' + customisedDays);
//     console.log('use_monday: ' + use_monday);
//     console.log('use_tuesday: ' + use_tuesday);
//     console.log('use_saturday: ' + use_saturday);
//     console.log('customisedTimes: ' + customisedTimes);
//     console.log('use_HTTPS: ' + use_HTTPS);
}

// function is_time_inaccurate() {
//     xhrRequest('http://www.timeapi.org/utc/now', 'GET', function (responseText) {
//         var local_date = new Date();
//         var remote_date = new Date(responseText);
//         var diff_ms = remote_date - local_date;    // this is the amount to add to the local time to correct it
        
//         time_diff_ms = diff_ms;
        
// //         console.log('get_time(): ' + remote_date);
// //         console.log('new Date(): ' + local_date);
// //         console.log('diff: ' + ());
        
// //         if (Math.abs(diff_ms) >= 30000) {
// //             return true;
// //         }
//     });
// }

Pebble.addEventListener('ready', function (e) {
    getConfigFromLocalStorage();
    
    // if using custom days or times, push this data to the watch
    if (customisedDays || customisedTimes) {
        var dictionary = {
            'KEY_UPDATE': 0,
            'KEY_CURRENT_ORIGIN': current_origin,
            'KEY_CURRENT_DESTINATION': current_destination,
            'CUSTOMISED_DAYS': customisedDays,
            'USE_MONDAY': use_monday,
            'USE_TUESDAY': use_tuesday,
            'USE_WEDNESDAY': use_wednesday,
            'USE_THURSDAY': use_thursday,
            'USE_FRIDAY': use_friday,
            'USE_SATURDAY': use_saturday,
            'USE_SUNDAY': use_sunday,
            'CUSTOMISED_TIMES': customisedTimes,
            'MORNING_START': parseInt(morning_start),
            'MORNING_END': parseInt(morning_end),
            'AFTERNOON_START': parseInt(afternoon_start),
            'AFTERNOON_END': parseInt(afternoon_end),
            'TIME_DIFF_FROM_UTC': time_diff_ms,
            'KEY_LAST_REQUEST_FAILED': 0,
            'KEY_UPDATE_ONLY_ON_TAP': update_only_on_tap
        };
    
        Pebble.sendAppMessage(dictionary, function (e) {}, function (e) {});
    }
    
    // build k-d tree data structure from station coordinate data
    stations_tree = new datastructure.KDTree(stations);
});

Pebble.addEventListener('appmessage', function (e) {
//     console.log('AppMessage received, useLocation: ' + useLocation);
    if (useLocation === true) {
        getLocation();
    }
    else {
        locationError(null);
    }
});

Pebble.addEventListener('showConfiguration', function(e) {
    var protocol = 'http';
    if (use_HTTPS === true) {
        protocol = 'https';
    }
    Pebble.openURL(protocol + '://stevenblair.github.io/commuter-bliss-uk/');
});

Pebble.addEventListener('webviewclosed', function(e) {
    var configData = JSON.parse(decodeURIComponent(e.response));
//     console.log('config: ' + JSON.stringify(configData));
    
    if ('home' in configData && configData.home.length == 3) {
        localStorage.setItem('home', configData.home);
    }
    if ('work' in configData && configData.work.length == 3) {
        localStorage.setItem('work', configData.work);
    }
    if ('useLocation' in configData) {
        localStorage.setItem('useLocation', configData.useLocation);
    }
    
    if ('customisedDays' in configData) {
        localStorage.setItem('customisedDays', configData.customisedDays);
    }
    if ('use_monday' in configData) {
        localStorage.setItem('use_monday', configData.use_monday);
    }
    if ('use_tuesday' in configData) {
        localStorage.setItem('use_tuesday', configData.use_tuesday);
    }
    if ('use_wednesday' in configData) {
        localStorage.setItem('use_wednesday', configData.use_wednesday);
    }
    if ('use_thursday' in configData) {
        localStorage.setItem('use_thursday', configData.use_thursday);
    }
    if ('use_friday' in configData) {
        localStorage.setItem('use_friday', configData.use_friday);
    }
    if ('use_saturday' in configData) {
        localStorage.setItem('use_saturday', configData.use_saturday);
    }
    if ('use_sunday' in configData) {
        localStorage.setItem('use_sunday', configData.use_sunday);
    }
    
    if ('customisedTimes' in configData) {
        localStorage.setItem('customisedTimes', configData.customisedTimes);
    }
    if ('morning_start' in configData) {
        localStorage.setItem('morning_start', configData.morning_start);
    }
    if ('morning_end' in configData) {
        localStorage.setItem('morning_end', configData.morning_end);
    }
    if ('afternoon_start' in configData) {
        localStorage.setItem('afternoon_start', configData.afternoon_start);
    }
    if ('afternoon_end' in configData) {
        localStorage.setItem('afternoon_end', configData.afternoon_end);
    }
    
    if ('use_HTTPS' in configData) {
        localStorage.setItem('use_HTTPS', configData.use_HTTPS);
    }
    
    if ('check_time' in configData) {
        localStorage.setItem('check_time', configData.check_time);
    }
    
    if ('update_only_on_tap' in configData) {
        localStorage.setItem('update_only_on_tap', configData.update_only_on_tap);
    }
    
    getConfigFromLocalStorage();
    
    if (useLocation === true) {
        getLocation();
    }
    else {
        locationError(null);
    }
});