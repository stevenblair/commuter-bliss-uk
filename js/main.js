// based on template: https://github.com/pebble-hacks/slate-watchface-template

(function() {
  loadOptions();
  createStationFinders();
  submitHandler();
})();

function optionsAreValid() {
  var $home = $('#home');
  var $work = $('#work');

  if (!($home.val().toUpperCase() in station_map)) {
    console.log('invalid home: ' + $home.val().toUpperCase());
    return false;
  }
  if (!($work.val().toUpperCase() in station_map)) {
    console.log('invalid work: ' + $work.val().toUpperCase());
    return false;
  }

  return true;
}

function submitHandler() {
  var $submitButton = $('#submitButton');

  $submitButton.on('click', function() {
    console.log('submit');

    if (optionsAreValid()) {
      var return_to = getQueryParam('return_to', 'pebblejs://close#');
      document.location = return_to + encodeURIComponent(JSON.stringify(getAndStoreConfigData()));
    }
    else {
      console.log('invalid station code(s)');
    }
  });

  var $cancelButton = $('#cancelButton');
  $cancelButton.on('click', function() {
    console.log('cancel');

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

  // if (localStorage.backgroundColor) {
  //   $backgroundColorPicker[0].value = localStorage.backgroundColor;
  //   $timeFormatCheckbox[0].checked = localStorage.twentyFourHourFormat === 'true';
  // }
  if (localStorage.home) {
    $home.val(localStorage.home);
    $work.val(localStorage.work);
  }
}

function getAndStoreConfigData() {
  var $home = $('#home');
  var $work = $('#work');
  // var $backgroundColorPicker = $('#backgroundColorPicker');
  // var $timeFormatCheckbox = $('#timeFormatCheckbox');

  var options = {
    home: $home.val().toUpperCase(),
    work: $work.val().toUpperCase()
  };
  // var options = {
  //   backgroundColor: $backgroundColorPicker.val(),
  //   twentyFourHourFormat: $timeFormatCheckbox[0].checked
  // };

  localStorage.home = options.home;
  localStorage.work = options.work;
  // localStorage.backgroundColor = options.backgroundColor;
  // localStorage.twentyFourHourFormat = options.twentyFourHourFormat;

  console.log('Got options: ' + JSON.stringify(options));
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