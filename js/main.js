// based on template: https://github.com/pebble-hacks/slate-watchface-template

var $mode = 0;

(function() {
  loadOptions();
  createCustomisedDayEvents();
  createCustomisedTimesEvents();
  createModeTabEvents();
  createUpdateOnlyOnTapVisibilityEvents();
  createStationFinders();
  submitHandler();

  // checkRouteFeasibility();
})();

function optionsAreValid() {
  var homeVal = $('#home').val().toUpperCase();
  var workVal = $('#work').val().toUpperCase();
  var viaVal = $('#via').val().toUpperCase();

  if (!(homeVal in station_map)) {
    // console.log('invalid home: ' + homeVal);
    return false;
  }
  if (!(workVal in station_map)) {
    // console.log('invalid work: ' + workVal);
    return false;
  }
  if (!(viaVal in station_map) && viaVal !== '') {
    // console.log('invalid work: ' + workVal);
    return false;
  }

  var morningStart = document.getElementById('morning-start');
  var morningEnd = document.getElementById('morning-end');
  var morning_start_val = parseInt(morningStart.options[morningStart.selectedIndex].value);
  var morning_end_val = parseInt(morningEnd.options[morningEnd.selectedIndex].value);

  if (morning_end_val < morning_start_val) {
    // console.log('invalid morning times: ' + morning_start_val + ', ' + morning_end_val);
    return false;
  }

  var afternoonStart = document.getElementById('afternoon-start');
  var afternoonEnd = document.getElementById('afternoon-end');
  var afternoon_start_val = parseInt(afternoonStart.options[afternoonStart.selectedIndex].value);
  var afternoon_end_val = parseInt(afternoonEnd.options[afternoonEnd.selectedIndex].value);

  if (afternoon_end_val < afternoon_start_val && afternoon_end_val != 0 && afternoon_end_val != 1 && afternoon_end_val != 2) {
    // console.log('invalid afternoon times: ' + afternoon_start_val + ', ' + afternoon_end_val);
    return false;
  }

  return true;
}

function checkRouteFeasibility() {
  var $routeValidity = $('#route-validity');
  var $routeValidityContainer = $('#route-validity-container');

  if ($mode === 2) {
    $routeValidityContainer.hide();
    $routeValidity.text('');
  }
  else {
    if (optionsAreValid()) {
      var homeVal = $('#home').val().toUpperCase();
      var workVal = $('#work').val().toUpperCase();
      var viaVal = $('#via').val().toUpperCase();

      $.ajax({
        type: 'GET',
        url: 'http://commuter-bliss-uk.apphb.com/departures/' + homeVal + '/to/' + workVal + '/1', 
        dataType: 'json',
        timeout: 1000,
        success: function(data) {
          $.ajax({
            type: 'GET',
            url: 'http://commuter-bliss-uk.apphb.com/departures/' + workVal + '/to/' + homeVal + '/1', 
            dataType: 'json',
            timeout: 1000,
            success: function(data_return) {
              // console.log(data);
              // console.log(data_return);
              var outward_possible = data.trainServices !== null && data.trainServices.length >= 1;
              var return_possible = data_return.trainServices !== null && data_return.trainServices.length >= 1;
              // console.log(outward_possible);
              // console.log(return_possible);

              if (outward_possible || return_possible) {
                // console.log('valid route');
                $routeValidity.text('Direct services are available');
                $routeValidityContainer.show();
              }
              else {
                // console.log('invalid route (now)');
                $routeValidity.text('No direct services are available (at this time)');
                $routeValidityContainer.show();
              }
            }
          });
        }
      });
    }
    else {
      $routeValidityContainer.hide();
      $routeValidity.text('');
    }
  }
}

function submitHandler() {
  var $submitButton = $('#submitButton');

  $submitButton.on('click', function() {
    // console.log('submit');
    if (optionsAreValid()) {
      var return_to = getQueryParam('return_to', 'pebblejs://close#');
      document.location = return_to + encodeURIComponent(JSON.stringify(getAndStoreConfigData()));
    }
    else {
      // console.log('invalid station code(s)');
    }
  });

  var $cancelButton = $('#cancelButton');
  $cancelButton.on('click', function() {
    // console.log('cancel');
    document.location = 'pebblejs://close';
  });
}

function stationFinder(inputName, footerName, checkRoute) {
  var $input = $(inputName);
  var $footer = $(footerName);

  $input.on('input', function(e) {
    var value = e.target.value.toUpperCase();

    if (value !== '') {
      if (value in station_map) {
        $footer.text('\u2714 ' + station_map[value] + ' (' + value + ')');
      }
      else {
        var possibles = [];

        for (var v in station_map) {
          // search by CRS code or station name substring
          if (v.toUpperCase().indexOf(value) > -1 || station_map[v].toUpperCase().indexOf(value) > -1) {
            possibles.push({'CRS': v, 'name': station_map[v]});
          }

          // limit number of matches
          if (possibles.length == 5) {
            break;
          }
        }

        var list = '';
        for (var i = 0; i < possibles.length; i++) {
          list += possibles[i].name + ' (' + possibles[i].CRS + ')';
          if (i < possibles.length - 1) {
            list += ', ';
          }
        }

        // autocomplete if only one match, unless key was backspace or delete
        if (possibles.length == 1 && value.length > 3) {
          list = '\u2714 ' + list;
          e.target.value = possibles[0].CRS;
        }

        if (possibles.length == 1 || value.length >= 2) {
          $footer.text(list);
        }
        else {
          $footer.text('   ');
        }
      }

      if (checkRoute) {
        checkRouteFeasibility();
      }
    }
    else {
      $footer.text('   ');
    }
  });

  $input.trigger('input');
}

function createStationFinders() {
  stationFinder('#home', '#home-footer', false);
  stationFinder('#work', '#work-footer', true);
  stationFinder('#via', '#via-footer', false);
}

function parseLocalStorage(type) {
   return typeof type == 'string' ? JSON.parse(type) : type;
}

function loadOptions() {
  var $home = $('#home');
  var $work = $('#work');
  var $via = $('#via');
  var $useLocation = $('#use-location');
  var $customisedDays = $('#customise-active-days');
  var $use_monday = $('#use_monday');
  var $use_tuesday = $('#use_tuesday');
  var $use_wednesday = $('#use_wednesday');
  var $use_thursday = $('#use_thursday');
  var $use_friday = $('#use_friday');
  var $use_saturday = $('#use_saturday');
  var $use_sunday = $('#use_sunday');
  var $customisedTimes = $('#customise-active-times');
  var $use_HTTPS = $('#use_HTTPS');
  var $update_only_on_tap = $('#update_only_on_tap');
  var $check_time = $('#check_time');
  var $time_colour = $('#time_colour');

  if (localStorage.getItem('mode') !== null) {
    $mode = parseInt(localStorage.mode);

    setTabMode();
  }

  if (localStorage.getItem('home') !== null) {
    $home.val(localStorage.home);
  }
  if (localStorage.getItem('work') !== null) {
    $work.val(localStorage.work);
  }
  if (localStorage.getItem('via') !== null) {
    $via.val(localStorage.via);
  }

  if (localStorage.getItem('useLocation') !== null) {
    // console.log('localStorage.useLocation: ' + localStorage.useLocation);
    $useLocation.prop("checked", parseLocalStorage(localStorage.useLocation));
  }

  if (localStorage.getItem('customisedDays') !== null) {
    // console.log('localStorage.customisedDays: ' + localStorage.customisedDays);
    $customisedDays.prop("checked", parseLocalStorage(localStorage.customisedDays));

    setCustomisedDayVisibility();
  }
  if (localStorage.getItem('use_monday') !== null) {
    $use_monday.prop("checked", parseLocalStorage(localStorage.use_monday));
  }
  if (localStorage.getItem('use_tuesday') !== null) {
    $use_tuesday.prop("checked", parseLocalStorage(localStorage.use_tuesday));
  }
  if (localStorage.getItem('use_wednesday') !== null) {
    $use_wednesday.prop("checked", parseLocalStorage(localStorage.use_wednesday));
  }
  if (localStorage.getItem('use_thursday') !== null) {
    $use_thursday.prop("checked", parseLocalStorage(localStorage.use_thursday));
  }
  if (localStorage.getItem('use_friday') !== null) {
    $use_friday.prop("checked", parseLocalStorage(localStorage.use_friday));
  }
  if (localStorage.getItem('use_saturday') !== null) {
    $use_saturday.prop("checked", parseLocalStorage(localStorage.use_saturday));
  }
  if (localStorage.getItem('use_sunday') !== null) {
    $use_sunday.prop("checked", parseLocalStorage(localStorage.use_sunday));
  }

  if (localStorage.getItem('customisedTimes') !== null) {
    // console.log('localStorage.customisedTimes: ' + localStorage.customisedTimes);
    $customisedTimes.prop("checked", parseLocalStorage(localStorage.customisedTimes));

    setCustomisedTimesVisibility();
  }
  if (localStorage.getItem('morning_start') !== null) {
    // console.log('localStorage.morningStart: ' + localStorage.morningStart);
    setSelectValue('morning-start', localStorage.morning_start);
  }
  if (localStorage.getItem('morning_end') !== null) {
    // console.log('localStorage.morningStart: ' + localStorage.morningStart);
    setSelectValue('morning-end', localStorage.morning_end);
  }
  if (localStorage.getItem('afternoon_start') !== null) {
    // console.log('localStorage.morningStart: ' + localStorage.morningStart);
    setSelectValue('afternoon-start', localStorage.afternoon_start);
  }
  if (localStorage.getItem('afternoon_end') !== null) {
    // console.log('localStorage.morningStart: ' + localStorage.morningStart);
    setSelectValue('afternoon-end', localStorage.afternoon_end);
  }

  if (localStorage.getItem('use_HTTPS') !== 'undefined' && localStorage.getItem('use_HTTPS') !== null) {
    $use_HTTPS.prop("checked", parseLocalStorage(localStorage.use_HTTPS));
  }
  else {
    localStorage.use_HTTPS = false;
    $use_HTTPS.prop("checked", false);
  }

  if (localStorage.getItem('update_only_on_tap') !== 'undefined' && localStorage.getItem('update_only_on_tap') !== null) {
    $update_only_on_tap.prop("checked", parseLocalStorage(localStorage.update_only_on_tap));

    setUpdateOnlyOnTapVisibility();
  }
  else {
    localStorage.update_only_on_tap = false;
    $update_only_on_tap.prop("checked", false);
  }

  if (localStorage.getItem('check_time') !== 'undefined' && localStorage.getItem('check_time') !== null) {
    $check_time.prop("checked", parseLocalStorage(localStorage.check_time));
  }
  else {
    localStorage.check_time = false;
    $check_time.prop("checked", false);
  }

  if (localStorage.getItem('time_colour') !== null) {
    $time_colour.val(localStorage.time_colour);
  }
}

function setSelectValue(name, value) {
  // var select = document.getElementById(name);
  // for (var i = 0; i < select.options.length; i++) {
  //   if (select.options[i].value == value) {
  //     select.options[i].selected = true;
  //   }
  // }
  document.getElementById(name).value = value;
}

function getAndStoreConfigData() {
  var $home = $('#home');
  var $work = $('#work');
  var $via = $('#via');
  var $useLocation = $('#use-location');
  var $customisedDays = $('#customise-active-days');
  var $use_monday = $('#use_monday');
  var $use_tuesday = $('#use_tuesday');
  var $use_wednesday = $('#use_wednesday');
  var $use_thursday = $('#use_thursday');
  var $use_friday = $('#use_friday');
  var $use_saturday = $('#use_saturday');
  var $use_sunday = $('#use_sunday');
  var $customisedTimes = $('#customise-active-times');
  var morningStart = document.getElementById('morning-start');
  var morningEnd = document.getElementById('morning-end');
  var afternoonStart = document.getElementById('afternoon-start');
  var afternoonEnd = document.getElementById('afternoon-end');
  var $use_HTTPS = $('#use_HTTPS');
  var $update_only_on_tap = $('#update_only_on_tap');
  var $check_time = $('#check_time');
  var $time_colour = $('#time_colour');

  var options = {
    mode: $mode,
    home: $home.val().toUpperCase(),
    work: $work.val().toUpperCase(),
    via: $via.val().toUpperCase(),
    useLocation: $useLocation.prop("checked"),
    customisedDays: $customisedDays.prop("checked"),
    use_monday: $use_monday.prop("checked"),
    use_tuesday: $use_tuesday.prop("checked"),
    use_wednesday: $use_wednesday.prop("checked"),
    use_thursday: $use_thursday.prop("checked"),
    use_friday: $use_friday.prop("checked"),
    use_saturday: $use_saturday.prop("checked"),
    use_sunday: $use_sunday.prop("checked"),
    customisedTimes: $customisedTimes.prop("checked"),
    morning_start: parseInt(morningStart.options[morningStart.selectedIndex].value),
    morning_end: parseInt(morningEnd.options[morningEnd.selectedIndex].value),
    afternoon_start: parseInt(afternoonStart.options[afternoonStart.selectedIndex].value),
    afternoon_end: parseInt(afternoonEnd.options[afternoonEnd.selectedIndex].value),
    use_HTTPS: $use_HTTPS.prop("checked"),
    update_only_on_tap: $update_only_on_tap.prop("checked"),
    check_time: $check_time.prop("checked"),
    time_colour: $time_colour.val()
  };

  localStorage.mode = options.mode;
  localStorage.home = options.home;
  localStorage.work = options.work;
  localStorage.via = options.via;
  localStorage.useLocation = options.useLocation;
  localStorage.customisedDays = options.customisedDays;
  localStorage.use_monday = options.use_monday;
  localStorage.use_tuesday = options.use_tuesday;
  localStorage.use_wednesday = options.use_wednesday;
  localStorage.use_thursday = options.use_thursday;
  localStorage.use_friday = options.use_friday;
  localStorage.use_saturday = options.use_saturday;
  localStorage.use_sunday = options.use_sunday;
  localStorage.customisedTimes = options.customisedTimes;
  localStorage.morning_start = options.morning_start;
  localStorage.morning_end = options.morning_end;
  localStorage.afternoon_start = options.afternoon_start;
  localStorage.afternoon_end = options.afternoon_end;
  localStorage.use_HTTPS = options.use_HTTPS;
  localStorage.update_only_on_tap = options.update_only_on_tap;
  localStorage.check_time = options.check_time;
  localStorage.time_colour = options.time_colour;

  // console.log('Got options: ' + JSON.stringify(options));

  return options;
}

function getQueryParam(variable, defaultValue) {
  var query = location.search.substring(1);
  var vars = query.split('&');
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split('=');
    if (pair[0] === variable) {
      return decodeURIComponent(pair[1]);
    }
  }
  return defaultValue || false;
}

function setUpdateOnlyOnTapVisibility() {
  var $update_only_on_tap = $('#update_only_on_tap');
  var $day_time_customisation = $('#day_time_customisation');

  if ($update_only_on_tap.attr('checked')) {
    $day_time_customisation.hide();
  }
  else {
    $day_time_customisation.show();
  }
}

function setCustomisedDayVisibility() {
  var $customisedDays = $('#customise-active-days');
  var $days = $('#days');
  var $customisedDaysFooter = $('#customise-active-days-footer');

  if ($customisedDays.attr('checked')) {
    $days.show();
    $customisedDaysFooter.text('Active on the following days:');
  }
  else {
    $days.hide();
    $customisedDaysFooter.text('Active every day');
  }
}

function setCustomisedTimesVisibility() {
  var $customisedTimes = $('#customise-active-times');
  var $times = $('#times');
  var $customisedTimesFooter = $('#customise-active-times-footer');

  if ($customisedTimes.attr('checked')) {
    $times.show();
    $customisedTimesFooter.text('Customise two periods during the day when the watch may request train data. Keep the range narrow to minimise the impact on watch (and phone) battery life.');
  }
  else {
    $times.hide();
    $customisedTimesFooter.text('Default schedule active: 7-11am and 3pm-1am.');
  }
}

function setTabMode() {
  var $viaContainer = $('#via-container');
  var $routeValidityContainer = $('#route-validity-container');

  if ($mode === 0) {
    $viaContainer.hide();
    $('#tab-fixed').addClass('active');
    $('#tab-gps').removeClass('active');
    $('#tab-two-stage').removeClass('active');
    $('#mode-footer').text('The home and work locations are fixed. Before noon, you will be shown journeys to work; from noon you will be shown journeys home.');

    // $routeValidityContainer.show();
    checkRouteFeasibility();
  }
  else if ($mode === 1) {
    $viaContainer.hide();
    $('#tab-fixed').removeClass('active');
    $('#tab-gps').addClass('active');
    $('#tab-two-stage').removeClass('active');
    $('#mode-footer').text('Your GPS location is used to find the nearest appropriate station to get you home or to work, depending on the time of day.');
    
    // $routeValidityContainer.show();
    checkRouteFeasibility();
  }
  else if ($mode === 2) {
    $viaContainer.show();
    $('#tab-fixed').removeClass('active');
    $('#tab-gps').removeClass('active');
    $('#tab-two-stage').addClass('active');
    $('#mode-footer').text('This mode allows you to make a connection in your journey. Add the connecting station to the "Via Railway Station" field. Your GPS location will be used to determine which leg of the journey you are on, and will update the train times for your next journey.');

    $routeValidityContainer.hide();
  }
}

function createUpdateOnlyOnTapVisibilityEvents() {
  var $update_only_on_tap = $('#update_only_on_tap');

  $update_only_on_tap.on('click', function() {
    setUpdateOnlyOnTapVisibility();
  });
}

function createCustomisedDayEvents() {
  var $customisedDays = $('#customise-active-days');

  $customisedDays.on('click', function() {
    setCustomisedDayVisibility();
  });
}

function createCustomisedTimesEvents() {
  var $customisedTimes = $('#customise-active-times');

  $customisedTimes.on('click', function() {
    setCustomisedTimesVisibility();
  });
}

function createModeTabEvents() {
  var $tabFixed = $('#tab-fixed');
  var $tabGPS = $('#tab-gps');
  var $tabTwoStage = $('#tab-two-stage');

  $tabFixed.on('click', function() {
    $mode = 0;
    setTabMode();
  });
  $tabGPS.on('click', function() {
    $mode = 1;
    setTabMode();
    // console.log($tabGPS);
    // return true;
  });
  $tabTwoStage.on('click', function() {
    $mode = 2;
    setTabMode();
    // console.log($tabTwoStage);
    // return true;
  });
}