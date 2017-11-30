# Commuter Bliss UK

A Pebble watchface for UK rail commuters.

Presentation overview: https://slides.com/stevenblair/commuter-bliss-uk

**[Pebble Appstore link](https://apps.getpebble.com/applications/55de44a8c46b80387c000070)**

<img src="https://assets.getpebble.com/api/file/XTzZmcpSfem1wjFUOGrf/convert?cache=true&fit=crop&w=144&h=168">
<img src="https://assets.getpebble.com/api/file/IAF3j4F4SLW81U1CmL6M/convert?cache=true&fit=crop&w=144&h=168">
<img src="https://assets.getpebble.com/api/file/CIeZBo6NR3KUwZVUBTR6/convert?cache=true&fit=crop&w=144&h=168">
<img src="https://assets.getpebble.com/api/file/1QlkkaTNT4CuU84mBcJA/convert?cache=true&fit=crop&w=144&h=168">
<!--<img src="https://assets.getpebble.com/api/file/NRn894ATQbuHOoN4Be7j/convert?cache=true&fit=crop&w=144&h=168">-->

# Features

Displays the next three trains for your daily commute to and from work. It is designed to require minimal effort to show important information that a rail commuter needs on a daily basis.

You can specify your normal home and work railway stations using the configuration page. Only direct rail services, and routes with one change, are supported.

Rail service data are obtained in real-time using the Huxley web service, which accesses National Rail Enquiries data. In GPS mode, the watchface requests your current location from your phone and determines the closest railway station. If you are near your configured home station, you will be shown routes to your work station; otherwise you will be shown routes home. This means that even if you happen to travel away from your normal work station, you may still be presented with a reasonable rail service to get home.

Alternatively, if location is disabled or unavailable, your journeys are still planned using the time of day and your predefined stations.

Updates are requested periodically, but can be requested at any time by "tapping" (shaking) the watch. When the next train is due to arrive or is slightly late, updates are triggered more frequently. Train times are only fetched during likely commuting times (but this can be customised).

Where specified in the data, the estimated time of departure (ETD) is displayed. Otherwise, the scheduled time of departure (STD) is shown.

The watchface also shows the time and date in a clear and sensible way for UK users.

## Details

* By default, train times are only shown on the watchface between 7am-11am and 3pm-1am, every day. This schedule can be customised from the configuration page.
* There are three modes: fixed route, GPS-based route, and two-stage journey.
* Your present location can be used to dynamically determine possible routes home, based the your nearest railway station. This mode can be disabled. ~~In any case, your exact location is not shared outside of the phone app.~~If enabled, your location will be be sent to the external server which processes the list of train services - this request is always sent using SSL.
* If location is disabled or unavailable, your normal home-to-work journeys will be shown in the morning; work-to-home routes will be shown after midday.
* By default, train routes are refreshed every 15 minutes. At the time the next train is due to depart (i.e. has 0 minutes left), an update is requested. If a train is delayed (shown by e.g. "-2 min"), an update is requested every minute.
* The platform number, if available, is shown in brackets on the bottom line.
* Clearly, it's important that your phone's clock is reasonably well-synchronised with Network Rail's clock!
* On loss of Bluetooth connection, the watch vibrates and the background turns blue (on Pebble Time) until the connection is restored.

## Acknowledgments

* [James Singleton](https://unop.uk/) for producing the [Huxley](https://github.com/jpsingleton/Huxley) project, which translates National Rail Enquiries' Darwin web service into a convenient JSON REST API.
* [Deon Botha](http://www.dbotha.com/) for the handy [JavaScript k-d tree implementation](https://github.com/dbotha/Javascript-k-d-tree).
* [AppHarbor](https://appharbor.com/) for hosting the dedicated Huxley instance.
* [Slate](https://github.com/pebble/slate) for the configuration page template and [helpful guide](https://www.youtube.com/watch?v=TtP7z6wceqI).
* GitHub for hosting the [configuration page](http://stevenblair.github.io/commuter-bliss-uk/).

## Planned features

* Add service query to determine journey duration and number of stops
* Query Huxley /delays URL?
* Only need to show departure times for immediate next train. This would free up space on UI for e.g. journey duration.
* Display warning if last_update is excessively far in the past (due to no data connection or otherwise)

Link to donate if you like this app: https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=XBYSZM4H48FQL
