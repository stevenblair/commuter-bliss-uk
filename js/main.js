// based on template: https://github.com/pebble-hacks/slate-watchface-template

(function() {
  loadOptions();
  createCustomisedDayEvents();
  createStationFinders();
  submitHandler();
})();

function optionsAreValid() {
  var homeVal = $('#home').val().toUpperCase();
  var workVal = $('#work').val().toUpperCase();

  if (!(homeVal in station_map)) {
    // console.log('invalid home: ' + homeVal);
    return false;
  }
  if (!(workVal in station_map)) {
    // console.log('invalid work: ' + workVal);
    return false;
  }

  return true;
}

function checkRouteFeasibility() {
  var $routeValidity = $('#route-validity');
  var $routeValidityContainer = $('#route-validity-container');

  if (optionsAreValid()) {
    var homeVal = $('#home').val().toUpperCase();
    var workVal = $('#work').val().toUpperCase();

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

function stationFinder(inputName, footerName) {
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
          $footer.text('');
        }
      }

      checkRouteFeasibility();
    }
    else {
      $footer.text('');
    }
  });
  $input.trigger('keyup');
}

function createStationFinders() {
  stationFinder('#home', '#home-footer');
  stationFinder('#work', '#work-footer');
}

function parseLocalStorage(type) {
   return typeof type == 'string' ? JSON.parse(type) : type;
}

function loadOptions() {
  var $home = $('#home');
  var $work = $('#work');
  var $useLocation = $('#use-location');
  var $customisedDays = $('#customise-active-days');
  var $use_monday = $('#use_monday');
  var $use_tuesday = $('#use_tuesday');
  var $use_wednesday = $('#use_wednesday');
  var $use_thursday = $('#use_thursday');
  var $use_friday = $('#use_friday');
  var $use_saturday = $('#use_saturday');
  var $use_sunday = $('#use_sunday');

  if (localStorage.getItem('home') !== null) {
    $home.val(localStorage.home);
  }
  if (localStorage.getItem('work') !== null) {
    $work.val(localStorage.work);
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
}

function getAndStoreConfigData() {
  var $home = $('#home');
  var $work = $('#work');
  var $useLocation = $('#use-location');
  var $customisedDays = $('#customise-active-days');
  var $use_monday = $('#use_monday');
  var $use_tuesday = $('#use_tuesday');
  var $use_wednesday = $('#use_wednesday');
  var $use_thursday = $('#use_thursday');
  var $use_friday = $('#use_friday');
  var $use_saturday = $('#use_saturday');
  var $use_sunday = $('#use_sunday');

  var options = {
    home: $home.val().toUpperCase(),
    work: $work.val().toUpperCase(),
    useLocation: $useLocation.prop("checked"),
    customisedDays: $customisedDays.prop("checked"),
    use_monday: $use_monday.prop("checked"),
    use_tuesday: $use_tuesday.prop("checked"),
    use_wednesday: $use_wednesday.prop("checked"),
    use_thursday: $use_thursday.prop("checked"),
    use_friday: $use_friday.prop("checked"),
    use_saturday: $use_saturday.prop("checked"),
    use_sunday: $use_sunday.prop("checked")
  };

  localStorage.home = options.home;
  localStorage.work = options.work;
  localStorage.useLocation = options.useLocation;
  localStorage.customisedDays = options.customisedDays;
  localStorage.use_monday = options.use_monday;
  localStorage.use_tuesday = options.use_tuesday;
  localStorage.use_wednesday = options.use_wednesday;
  localStorage.use_thursday = options.use_thursday;
  localStorage.use_friday = options.use_friday;
  localStorage.use_saturday = options.use_saturday;
  localStorage.use_sunday = options.use_sunday;

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

function setCustomisedDayVisibility() {
  var $customisedDays = $('#customise-active-days');
  var $customisedDaysFooter = $('#customise-active-days-footer');
  var $days = $('#days');

  if ($customisedDays.attr('checked')) {
    $days.show();
    $customisedDaysFooter.text('Active on the following days:');
  }
  else {
    $days.hide();
    $customisedDaysFooter.text('Active every day');
  }
}

function createCustomisedDayEvents() {
  var $customisedDays = $('#customise-active-days');

  $customisedDays.on('click', function() {
    setCustomisedDayVisibility();
  });
}