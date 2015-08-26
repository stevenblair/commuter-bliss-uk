// based on template: https://github.com/pebble-hacks/slate-watchface-template

(function() {
  loadOptions();
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
        // console.log(data);
        if (data.trainServices && data.trainServices.length >= 1) {
          // console.log('valid route');
          $routeValidity.text('Direct services are available');
          $routeValidityContainer.show();
        }
        else {
          // console.log('invalid route');
          $routeValidity.text('No direct services are available (at this time)');
          $routeValidityContainer.show();
        }
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

  $input.on('keyup', function(e) {
    var value = e.target.value.toUpperCase();
    if (value in station_map) {
      $footer.text(station_map[value]);
    }
    else {
      $footer.text('');
    }

    checkRouteFeasibility();
  });
  $input.trigger('keyup');
}

function createStationFinders() {
  stationFinder('#home', '#home-footer');
  stationFinder('#work', '#work-footer');
}

function loadOptions() {
  var $home = $('#home');
  var $work = $('#work');

  if (localStorage.home) {
    $home.val(localStorage.home);
    $work.val(localStorage.work);
  }
}

function getAndStoreConfigData() {
  var $home = $('#home');
  var $work = $('#work');

  var options = {
    home: $home.val().toUpperCase(),
    work: $work.val().toUpperCase()
  };

  localStorage.home = options.home;
  localStorage.work = options.work;

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