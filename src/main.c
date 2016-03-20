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


#include <pebble.h>

#define BATTERY_INDICATOR_X        138
#define BATTERY_INDICATOR_Y        6
#define BATTERY_INDICATOR_RADIUS   3

#define NETWORK_INDICATOR_X        6
#define NETWORK_INDICATOR_Y        6
#define NETWORK_INDICATOR_RADIUS   3

#define MINUTE_ROLLOVER_THRESHOLD  2


// AppMessage keys
enum {
    KEY_UPDATE = 0,                 // used to trigger update from Pebble to phone
    KEY_CURRENT_ORIGIN = 1,         // string of station code
    KEY_CURRENT_DESTINATION = 2,    // string of station code
    KEY_TRAIN1_TIME = 3,            // time_t value stored as int
    KEY_TRAIN1_DEST = 4,            // string of station code
    KEY_TRAIN1_PLATFORM = 5,        // int of origin station platform number
    KEY_TRAIN2_TIME = 6,            // time_t value stored as int
    KEY_TRAIN3_TIME = 7,            // time_t value stored as int
    KEY_TRAIN1_IS_CANCELED = 8,     // boolean value stored as int
    CUSTOMISED_DAYS = 9,            // boolean value stored as int
    USE_MONDAY = 10,                // boolean value stored as int
    USE_TUESDAY = 11,               // boolean value stored as int
    USE_WEDNESDAY = 12,             // boolean value stored as int
    USE_THURSDAY = 13,              // boolean value stored as int
    USE_FRIDAY = 14,                // boolean value stored as int
    USE_SATURDAY = 15,              // boolean value stored as int
    USE_SUNDAY = 16,                // boolean value stored as int
    CUSTOMISED_TIMES = 17,          // boolean value stored as int
    MORNING_START = 18,             // int
    MORNING_END = 19,               // int
    AFTERNOON_START = 20,           // int
    AFTERNOON_END = 21,             // int
    KEY_TRAIN2_IS_CANCELED = 24,    // boolean value stored as int
    KEY_TRAIN3_IS_CANCELED = 25,    // boolean value stored as int
    TIME_DIFF_FROM_UTC = 26,        // int
    KEY_LAST_REQUEST_FAILED = 27,   // boolean value stored as int
    KEY_UPDATE_ONLY_ON_TAP = 28   // boolean value stored as int
};

// train update settings
const uint32_t INITIAL_UPDATE_DELAY_MILLISECONDS = 3000;
const uint32_t REMOVE_TAP_UPDATE_DELAY_MILLISECONDS = 60000;
const int32_t TRAIN_UPDATE_PERIOD_MINUTES = 15;
const int32_t MAX_DURATION_WITHOUT_UPDATE_MINUTES = -99;

// train update schedule
//   time values use 24 h clock: 0-23
//   AFTERNOON_UPDATES_END_HOUR can be after midnight
static int use_customised_days = 0;
static int customised_days_array[7] = {1, 1, 1, 1, 1, 1, 1};
static int use_customised_times = 0;
const int DEFAULT_MORNING_UPDATES_START_HOUR = 7;
const int DEFAULT_MORNING_UPDATES_END_HOUR = 11;
const int DEFAULT_AFTERNOON_UPDATES_START_HOUR = 16;
const int DEFAULT_AFTERNOON_UPDATES_END_HOUR = 20;
static int MORNING_UPDATES_START_HOUR = 7;
static int MORNING_UPDATES_END_HOUR = 11;
static int AFTERNOON_UPDATES_START_HOUR = 16;
static int AFTERNOON_UPDATES_END_HOUR = 20;

// UI
const uint16_t TRAIN_TIMES_X_OFFSET = 5;
const uint16_t TRAIN_TIMES_Y_OFFSET = 105;
static Window *s_main_window;
static TextLayer *s_time_layer;
static TextLayer *s_date_layer;
static TextLayer *s_next_train_col1_layer;
static TextLayer *s_next_train_col2_layer;
static TextLayer *s_next_train_col3_layer;
static Layer *s_info_layer;
static TextLayer *s_time_diff_layer;
AppTimer *remove_tap_update_timer = NULL;

// train data
static char current_origin[] = "XXX";
static char current_destination[] = "XXX";
static time_t train1_time = 0;
static time_t train2_time = 0;
static time_t train3_time = 0;
static char train1_time_buf[] = "999 min\n00:00\nXXX to XXX (99)";
static char train2_time_buf[] = "999 min\n00:00";
static char train3_time_buf[] = "999 min\n00:00";
static char train1_dest[] = "XXX";
static int train1_platform = 0;
static int train1_is_cancelled = 0;
static int train2_is_cancelled = 0;
static int train3_is_cancelled = 0;
static time_t last_update = 0;
static int time_diff_s = 0;
static char time_diff_buf[] = "-99999";
static int last_request_failed = 0;
static int update_only_on_tap = 0;


static void remove_char(char *str, char to_remove) {
    // removes first instance of specified character
    // modified implementation from: http://stackoverflow.com/a/8733511/57743
    char *src, *dst;
    bool found = false;
    
    for (src = dst = str; *src != '\0'; src++) {
        *dst = *src;
        if (*dst != to_remove || found) {
            dst++;
        }
        else {
            found = true;
        }
    }
    *dst = '\0';
}

static bool is_train_update_period() {
//     return true;    // TODO for testing
    
    if (update_only_on_tap) {
        return true;
    }
    
    time_t temp = time(NULL); 
    struct tm *tick_time = localtime(&temp);
    
//     APP_LOG(APP_LOG_LEVEL_ERROR, "is_train_update_period() days: %i, %i, %i, %i, %i, %i, %i, %i, %i", tick_time->tm_wday, use_customised_days, customised_days_array[0], customised_days_array[1], customised_days_array[2], customised_days_array[3], customised_days_array[4], customised_days_array[5], customised_days_array[6]);
//     APP_LOG(APP_LOG_LEVEL_ERROR, "is_train_update_period() hours: %i, %i, %i, %i, %i", tick_time->tm_hour, MORNING_UPDATES_START_HOUR, MORNING_UPDATES_END_HOUR, AFTERNOON_UPDATES_START_HOUR, AFTERNOON_UPDATES_END_HOUR);
    
    if (use_customised_days) {
        if (customised_days_array[tick_time->tm_wday] == 0) {
//             APP_LOG(APP_LOG_LEVEL_DEBUG, "  false");
            return false;
        }
    }
    
    if (tick_time->tm_hour >= MORNING_UPDATES_START_HOUR && tick_time->tm_hour < MORNING_UPDATES_END_HOUR) {
//         APP_LOG(APP_LOG_LEVEL_DEBUG, "  true - morning");
        return true;
    }

    // two cases: update ends after midnight, or update ends before midnight
    if (AFTERNOON_UPDATES_END_HOUR < AFTERNOON_UPDATES_START_HOUR) {
        if ((tick_time->tm_hour >= AFTERNOON_UPDATES_START_HOUR && tick_time->tm_hour <= 23) || (tick_time->tm_hour >= 0 && tick_time->tm_hour < AFTERNOON_UPDATES_END_HOUR)) {
//             APP_LOG(APP_LOG_LEVEL_DEBUG, "  true - evening");
            return true;
        }
    }
    else {
        if (tick_time->tm_hour >= AFTERNOON_UPDATES_START_HOUR && tick_time->tm_hour < AFTERNOON_UPDATES_END_HOUR) {
//             APP_LOG(APP_LOG_LEVEL_DEBUG, "  true - evening");
            return true;
        }
    }
    
//     APP_LOG(APP_LOG_LEVEL_DEBUG, "  false - end");
    return false;
}

static void request_trains_update() {
    if (is_train_update_period()) {
        DictionaryIterator *iter;
        app_message_outbox_begin(&iter);        // begin dictionary
        dict_write_uint8(iter, KEY_UPDATE, 1);  // add a key-value pair
        app_message_outbox_send();              // send the message
    }
    
    layer_mark_dirty(s_info_layer);
}

static void initial_update() {
    if (!update_only_on_tap) {
        request_trains_update();
    }
}

static bool update_UI(struct tm *tick_time) {
//     APP_LOG(APP_LOG_LEVEL_DEBUG, "update_UI()");
    bool need_train_update = false;
    bool can_update = is_train_update_period();
    
    // get time structures
    time_t temp = time(NULL); 
    struct tm *tick_time_zero_seconds = localtime(&temp);
    tick_time_zero_seconds->tm_sec = 0;                                   // set seconds to zero to ensure consist display
    time_t now = mktime(tick_time_zero_seconds);

    static char time_buffer[] = "00:00";
    clock_copy_time_string(time_buffer, sizeof(time_buffer));
    text_layer_set_text(s_time_layer, time_buffer);
    
    static char date_buffer[] = "Wednesday\n30 September";                // create maximum sized date buffer
    strftime(date_buffer, sizeof(date_buffer), "%A\n%e %B", tick_time);   // comment-out this line to test max string length
                
    // remove initial ' ' in date format output i.e. if ' ' follows '\n'
    char *quotPtr = strchr(date_buffer, '\n');
    if (quotPtr != NULL) {
        int position = quotPtr - date_buffer;
        if (date_buffer[position + 1] == ' ') {
            remove_char(date_buffer, ' ');
        }
    }
    
    text_layer_set_text(s_date_layer, date_buffer);
    layer_mark_dirty(s_info_layer);
    
//     // for testing UI
//     can_update = true;
//     train1_time = mktime(tick_time) - 1000;
//     train2_time = mktime(tick_time) + 2000;
//     train3_time = mktime(tick_time) + 4000;
//     train1_platform = 14;
    
    if (can_update) {
        if (train1_time != 0) {
            int diff_min = (train1_time - now) / 60;
            
            // no updates for while - give up and remove train times
            if (diff_min < MAX_DURATION_WITHOUT_UPDATE_MINUTES) {
                text_layer_set_text(s_next_train_col1_layer, "");
                text_layer_set_text(s_next_train_col2_layer, "");
                text_layer_set_text(s_next_train_col3_layer, "");
                return false;
            }
            
            // train arrival imminent - try to get latest info
            if (diff_min <= 0) {
                need_train_update = true;
            }
            
            snprintf(train1_time_buf, sizeof(train1_time_buf), "%d min\n", diff_min);
            int str_next = strlen(train1_time_buf);
            
            struct tm *train1_time_tm = localtime(&train1_time);
            if (clock_is_24h_style()) {
                strftime(&train1_time_buf[str_next], sizeof(train1_time_buf) - str_next, "%H:%M\n", train1_time_tm);
            }
            else {
                strftime(&train1_time_buf[str_next], sizeof(train1_time_buf) - str_next, "%l:%M\n", train1_time_tm);
                
                // remove initial space in 12 h format output
                if (train1_time_buf[str_next] == ' ') {
                    remove_char(&train1_time_buf[str_next], ' ');
                }
            }
            
            str_next = strlen(train1_time_buf);
            if (train1_is_cancelled) {
                snprintf(&train1_time_buf[str_next], sizeof(train1_time_buf) - str_next, "Cancelled");
    #ifdef PBL_COLOR
                text_layer_set_text_color(s_next_train_col1_layer, GColorDarkCandyAppleRed);
    #else
                text_layer_set_text_color(s_next_train_col1_layer, GColorWhite);
    #endif
            }
            else {
    #ifdef PBL_COLOR
                text_layer_set_text_color(s_next_train_col1_layer, GColorWhite);
    #endif
                if (train1_platform > 0) {
                    snprintf(&train1_time_buf[str_next], sizeof(train1_time_buf) - str_next, "%s to %s (%i)", current_origin, train1_dest, train1_platform);
                }
                else {
                    snprintf(&train1_time_buf[str_next], sizeof(train1_time_buf) - str_next, "%s to %s", current_origin, train1_dest);
                }
            }
            
            text_layer_set_text(s_next_train_col1_layer, train1_time_buf);
        }
        else {
            text_layer_set_text(s_next_train_col1_layer, "");
        }
        
        if (train2_time != 0) {
            int diff_min = (train2_time - now) / 60;
//             APP_LOG(APP_LOG_LEVEL_ERROR, "train2_time, now, diff_min: %i, %i, %i", (int) train2_time, (int) now, diff_min);
            if (train2_is_cancelled) {
                snprintf(train2_time_buf, sizeof(train2_time_buf), "canc.\n");
            }
            else {
                snprintf(train2_time_buf, sizeof(train2_time_buf), "%d min\n", diff_min);
            }
            int str_next = strlen(train2_time_buf);
            
            struct tm *train2_time_tm = localtime(&train2_time);
            if (clock_is_24h_style()) {
                strftime(&train2_time_buf[str_next], sizeof(train2_time_buf) - str_next, "%H:%M\n", train2_time_tm);
            }
            else {
                strftime(&train2_time_buf[str_next], sizeof(train2_time_buf) - str_next, "%l:%M\n", train2_time_tm);
                
                // remove initial space in 12 h format output
                if (train2_time_buf[str_next] == ' ') {
                    remove_char(&train2_time_buf[str_next], ' ');
                }
            }
            
    #ifdef PBL_COLOR
            if (train2_is_cancelled) {
                text_layer_set_text_color(s_next_train_col2_layer, GColorDarkCandyAppleRed);
            }
            else {
                text_layer_set_text_color(s_next_train_col2_layer, GColorWhite);
            }
    #endif
            
            text_layer_set_text(s_next_train_col2_layer, train2_time_buf);
        }
        else {
            text_layer_set_text(s_next_train_col2_layer, "");
        }
        
        if (train3_time != 0) {
            int diff_min = (train3_time - now) / 60;
            if (train3_is_cancelled) {
                snprintf(train3_time_buf, sizeof(train3_time_buf), "canc.\n");
            }
            else {
                snprintf(train3_time_buf, sizeof(train3_time_buf), "%d min\n", diff_min);
            }
            int str_next = strlen(train3_time_buf);
            
            struct tm *train3_time_tm = localtime(&train3_time);
            if (clock_is_24h_style()) {
                strftime(&train3_time_buf[str_next], sizeof(train3_time_buf) - str_next, "%H:%M\n", train3_time_tm);
            }
            else {
                strftime(&train3_time_buf[str_next], sizeof(train3_time_buf) - str_next, "%l:%M\n", train3_time_tm);
                
                // remove initial space in 12 h format output
                if (train3_time_buf[str_next] == ' ') {
                    remove_char(&train3_time_buf[str_next], ' ');
                }
            }
            
    #ifdef PBL_COLOR
            if (train3_is_cancelled) {
                text_layer_set_text_color(s_next_train_col3_layer, GColorDarkCandyAppleRed);
            }
            else {
                text_layer_set_text_color(s_next_train_col3_layer, GColorWhite);
            }
    #endif
            
            text_layer_set_text(s_next_train_col3_layer, train3_time_buf);
        }
        else {
            text_layer_set_text(s_next_train_col3_layer, "");
        }
    }
    else {
        text_layer_set_text(s_next_train_col1_layer, "");
        text_layer_set_text(s_next_train_col2_layer, "");
        text_layer_set_text(s_next_train_col3_layer, "");
        
        return can_update;
    }
    
    return need_train_update;
}

static void info_layer_update_callback(Layer *layer, GContext *ctx) {
    BatteryChargeState chargeState = battery_state_service_peek();
    uint8_t percent = chargeState.charge_percent;
    
    if (percent <= 10) {
#ifdef PBL_COLOR
        graphics_context_set_fill_color(ctx, GColorDarkCandyAppleRed);
#else
        graphics_context_set_fill_color(ctx, GColorWhite);
#endif
        graphics_fill_circle(ctx, GPoint(BATTERY_INDICATOR_X, BATTERY_INDICATOR_Y), BATTERY_INDICATOR_RADIUS);
    }
    else if (percent <= 20) {
#ifdef PBL_COLOR
        graphics_context_set_fill_color(ctx, GColorDarkGray);
#else
        graphics_context_set_fill_color(ctx, GColorWhite);
#endif
        graphics_fill_circle(ctx, GPoint(BATTERY_INDICATOR_X, BATTERY_INDICATOR_Y), BATTERY_INDICATOR_RADIUS);
    }
    
    if (abs(time_diff_s) >= 30) {
        snprintf(time_diff_buf, sizeof(time_diff_buf), "%i", time_diff_s);
        text_layer_set_text(s_time_diff_layer, time_diff_buf);
    }
    else {
        text_layer_set_text(s_time_diff_layer, "");
    }
    
    if (last_request_failed == 1) {
#ifdef PBL_COLOR
        graphics_context_set_fill_color(ctx, GColorDarkCandyAppleRed);
#else
        graphics_context_set_fill_color(ctx, GColorWhite);
#endif
//         GRect rect = GRect(0, 0, NETWORK_INDICATOR_X, NETWORK_INDICATOR_Y);
        GRect rect = GRect(3, 3, 6, 6);
//         graphics_draw_round_rect(ctx, rect, 1);//NETWORK_INDICATOR_RADIUS);
        graphics_fill_rect(ctx, rect, 0, GCornerNone);//NETWORK_INDICATOR_RADIUS);
    }
}

static void main_window_load(Window *window) {
    window_set_background_color(window, GColorBlack);
    
    // create time TextLayer
    s_time_layer = text_layer_create(GRect(0, 52, 144, 52));
    text_layer_set_background_color(s_time_layer, GColorClear);
#ifdef PBL_COLOR
    text_layer_set_text_color(s_time_layer, GColorDarkCandyAppleRed);
#else
    text_layer_set_text_color(s_time_layer, GColorWhite);
#endif
    text_layer_set_font(s_time_layer, fonts_get_system_font(FONT_KEY_ROBOTO_BOLD_SUBSET_49));
    text_layer_set_text_alignment(s_time_layer, GTextAlignmentCenter);
    layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_time_layer));
    
    // create date TextLayer
    s_date_layer = text_layer_create(GRect(0, -3, 144, 64));
    text_layer_set_background_color(s_date_layer, GColorClear);
    text_layer_set_text_color(s_date_layer, GColorWhite);
    text_layer_set_overflow_mode(s_date_layer, GTextOverflowModeWordWrap);
    text_layer_set_font(s_date_layer, fonts_get_system_font(FONT_KEY_GOTHIC_28));
    text_layer_set_text_alignment(s_date_layer, GTextAlignmentCenter);
    layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_date_layer));
    
    // create train info layers
    s_next_train_col1_layer = text_layer_create(GRect(TRAIN_TIMES_X_OFFSET, TRAIN_TIMES_Y_OFFSET, 144 - TRAIN_TIMES_X_OFFSET, 60));
    text_layer_set_background_color(s_next_train_col1_layer, GColorClear);
    text_layer_set_text_color(s_next_train_col1_layer, GColorWhite);
    text_layer_set_font(s_next_train_col1_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD));
    text_layer_set_text_alignment(s_next_train_col1_layer, GTextAlignmentLeft);
//     text_layer_set_text(s_next_train_col1_layer, "one\ntwo\nthree three three");
    layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_next_train_col1_layer));
    
    s_next_train_col2_layer = text_layer_create(GRect(48 + 6 + TRAIN_TIMES_X_OFFSET, TRAIN_TIMES_Y_OFFSET, 43, 40));
    text_layer_set_background_color(s_next_train_col2_layer, GColorClear);
    text_layer_set_text_color(s_next_train_col2_layer, GColorWhite);
    text_layer_set_font(s_next_train_col2_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18));
    text_layer_set_text_alignment(s_next_train_col2_layer, GTextAlignmentLeft);
//     text_layer_set_text(s_next_train_col2_layer, "one\ntwo");
    layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_next_train_col2_layer));
    
    s_next_train_col3_layer = text_layer_create(GRect(96 + 1 + TRAIN_TIMES_X_OFFSET, TRAIN_TIMES_Y_OFFSET, 46, 40));
    text_layer_set_background_color(s_next_train_col3_layer, GColorClear);
    text_layer_set_text_color(s_next_train_col3_layer, GColorWhite);
    text_layer_set_font(s_next_train_col3_layer, fonts_get_system_font(FONT_KEY_GOTHIC_18));
    text_layer_set_text_alignment(s_next_train_col3_layer, GTextAlignmentLeft);
//     text_layer_set_text(s_next_train_col3_layer, "one\ntwo");
    layer_add_child(window_get_root_layer(window), text_layer_get_layer(s_next_train_col3_layer));
    
    // create battery info layer
    s_info_layer = layer_create(GRect(0, 0, 144, 16));
//     layer_set_background_color(s_info_layer, GColorClear);
    layer_set_update_proc(s_info_layer, info_layer_update_callback);
    layer_add_child(window_get_root_layer(window), s_info_layer);
    
    // create time info layer
    s_time_diff_layer = text_layer_create(GRect(3, 0, 144, 16));
    text_layer_set_background_color(s_time_diff_layer, GColorClear);
    text_layer_set_text_color(s_time_diff_layer, GColorWhite);
    text_layer_set_font(s_time_diff_layer, fonts_get_system_font(FONT_KEY_GOTHIC_09));
    text_layer_set_text_alignment(s_time_diff_layer, GTextAlignmentLeft);
    layer_add_child(s_info_layer, text_layer_get_layer(s_time_diff_layer));
    
    // make sure the time is displayed from the start
    time_t temp = time(NULL); 
    struct tm *tick_time = localtime(&temp);
    update_UI(tick_time);
    
    // schedule an update of train times after initialisation
    app_timer_register(INITIAL_UPDATE_DELAY_MILLISECONDS, initial_update, NULL);
}

static void main_window_unload(Window *window) {
    // destroy TextLayers
    text_layer_destroy(s_time_layer);
    text_layer_destroy(s_date_layer);
    text_layer_destroy(s_next_train_col1_layer);
    text_layer_destroy(s_next_train_col2_layer);
    text_layer_destroy(s_next_train_col3_layer);
    text_layer_destroy(s_time_diff_layer);
    layer_destroy(s_info_layer);
}

static void tick_handler(struct tm *tick_time, TimeUnits units_changed) {
//     APP_LOG(APP_LOG_LEVEL_DEBUG, "in tick_handler()");
    
//     if (update_only_on_tap) {
// //         APP_LOG(APP_LOG_LEVEL_DEBUG, "reseting train times");
// //         minute_rollovers_since_last_update++;
        
// //         if (minute_rollovers_since_last_update >= MINUTE_ROLLOVER_THRESHOLD) {
// //             minute_rollovers_since_last_update = 0;
//             train1_time = 0;
//             train2_time = 0;
//             train3_time = 0;
// //       }
//     }
    
    bool need_train_update = update_UI(tick_time);
    
    if (!update_only_on_tap) {
//         APP_LOG(APP_LOG_LEVEL_DEBUG, "requesting update");
       if (need_train_update || (tick_time->tm_sec == 0 && tick_time->tm_min % TRAIN_UPDATE_PERIOD_MINUTES == 0)) {
            // get update when requested (for imminent trains) and periodically; ensure additional requests are made once per minute at most
            request_trains_update();
       }
    }
}

void bluetooth_connection_callback(bool connected) {
    vibes_long_pulse();
    
#ifdef PBL_COLOR
    if (connected) {
        window_set_background_color(s_main_window, GColorBlack);
    }
    else {
        window_set_background_color(s_main_window, GColorBlue);
    }
#endif
}

static void inbox_received_callback(DictionaryIterator *iterator, void *context) {
    // read first item
    Tuple *t = dict_read_first(iterator);

    // for all items
    while(t != NULL) {
        switch(t->key) {
            case KEY_UPDATE:
                break;
            case KEY_CURRENT_ORIGIN:
                snprintf(current_origin, sizeof(current_origin), "%s", t->value->cstring);
                break;
            case KEY_CURRENT_DESTINATION:
                snprintf(current_destination, sizeof(current_destination), "%s", t->value->cstring);
                break;
            case KEY_TRAIN1_TIME:
                train1_time = t->value->int32;
                break;
            case KEY_TRAIN1_DEST:
                snprintf(train1_dest, sizeof(train1_dest), "%s", t->value->cstring);
                break;
            case KEY_TRAIN1_PLATFORM:
//                 APP_LOG(APP_LOG_LEVEL_DEBUG, "KEY_TRAIN1_PLATFORM: len: %d, %d, %s", t->length, t->value->int16, t->value->cstring);
                train1_platform = t->value->int32;
                break;
            case KEY_TRAIN2_TIME:
                train2_time = t->value->int32;
                break;
            case KEY_TRAIN3_TIME:
                train3_time = t->value->int32;
                break;
            case KEY_TRAIN1_IS_CANCELED:
                train1_is_cancelled = t->value->int16;
                break;
            case CUSTOMISED_DAYS:
//                 use_customised_days = (strcmp(t->value->cstring, "true") == 0);
//                 APP_LOG(APP_LOG_LEVEL_DEBUG, "CUSTOMISED_DAYS: len: %d, %d, %s", t->length, t->value->int16, t->value->cstring);
                use_customised_days = t->value->int16;
                break;
            case USE_MONDAY:
//                 customised_days_array[1] = (strcmp(t->value->cstring, "true") == 0);
                customised_days_array[1] = t->value->int16;
                break;
            case USE_TUESDAY:
//                 customised_days_array[2] = (strcmp(t->value->cstring, "true") == 0);
                customised_days_array[2] = t->value->int16;
                break;
            case USE_WEDNESDAY:
//                 customised_days_array[3] = (strcmp(t->value->cstring, "true") == 0);
                customised_days_array[3] = t->value->int16;
                break;
            case USE_THURSDAY:
//                 customised_days_array[4] = (strcmp(t->value->cstring, "true") == 0);
                customised_days_array[4] = t->value->int16;
                break;
            case USE_FRIDAY:
//                 customised_days_array[5] = (strcmp(t->value->cstring, "true") == 0);
//                 APP_LOG(APP_LOG_LEVEL_DEBUG, "USE_FRIDAY: len: %d, %d, %s", t->length, t->value->int16, t->value->cstring);
                customised_days_array[5] = t->value->int16;
                break;
            case USE_SATURDAY:
//                 customised_days_array[6] = (strcmp(t->value->cstring, "true") == 0);
//                 APP_LOG(APP_LOG_LEVEL_DEBUG, "USE_SATURDAY: len: %d, %d, %s", t->length, t->value->int16, t->value->cstring);
                customised_days_array[6] = t->value->int16;
                break;
            case USE_SUNDAY:
//                 customised_days_array[0] = (strcmp(t->value->cstring, "true") == 0);
                customised_days_array[0] = t->value->int16;
                break;
            case CUSTOMISED_TIMES:
//                 use_customised_times = (strcmp(t->value->cstring, "true") == 0);
                use_customised_times = t->value->int16;
                break;
            case MORNING_START:
                MORNING_UPDATES_START_HOUR = t->value->int32;
                break;
            case MORNING_END:
//                 APP_LOG(APP_LOG_LEVEL_DEBUG, "MORNING_UPDATES_END_HOUR: len: %d, %d, %d, %s", t->length, t->value->int16, (int) t->value->int32, t->value->cstring);
                MORNING_UPDATES_END_HOUR = t->value->int32;
                break;
            case AFTERNOON_START:
                AFTERNOON_UPDATES_START_HOUR = t->value->int32;
                break;
            case AFTERNOON_END:
                AFTERNOON_UPDATES_END_HOUR = t->value->int32;
                break;
            case KEY_TRAIN2_IS_CANCELED:
                train2_is_cancelled = t->value->int16;
                break;
            case KEY_TRAIN3_IS_CANCELED:
                train3_is_cancelled = t->value->int16;
                break;
            case TIME_DIFF_FROM_UTC:
                time_diff_s = t->value->int32 / 1000;
                break;
            case KEY_LAST_REQUEST_FAILED:
                last_request_failed = t->value->int16;
                break;
            case KEY_UPDATE_ONLY_ON_TAP:
                update_only_on_tap = t->value->int16;
                break;
            default:
                break;
        }

        // look for next item
        t = dict_read_next(iterator);
    }
    
//     APP_LOG(APP_LOG_LEVEL_ERROR, "%i, %i, %i, %i, %i, %i, %i", customised_days_array[0], customised_days_array[1], customised_days_array[2], customised_days_array[3], customised_days_array[4], customised_days_array[5], customised_days_array[6]);
//     APP_LOG(APP_LOG_LEVEL_ERROR, "before: %i, %i, %i, %i, %i", use_customised_times, MORNING_UPDATES_START_HOUR, MORNING_UPDATES_END_HOUR, AFTERNOON_UPDATES_START_HOUR, AFTERNOON_UPDATES_END_HOUR);
    
    // reset update times to defaults
    if (!use_customised_times) {
        MORNING_UPDATES_START_HOUR = DEFAULT_MORNING_UPDATES_START_HOUR;
        MORNING_UPDATES_END_HOUR = DEFAULT_MORNING_UPDATES_END_HOUR;
        AFTERNOON_UPDATES_START_HOUR = DEFAULT_AFTERNOON_UPDATES_START_HOUR;
        AFTERNOON_UPDATES_END_HOUR = DEFAULT_AFTERNOON_UPDATES_END_HOUR;
    }
    
//     APP_LOG(APP_LOG_LEVEL_ERROR, "after: %i, %i, %i, %i, %i", use_customised_times, MORNING_UPDATES_START_HOUR, MORNING_UPDATES_END_HOUR, AFTERNOON_UPDATES_START_HOUR, AFTERNOON_UPDATES_END_HOUR);
    
    // update display
    last_update = time(NULL);
    struct tm *tick_time = localtime(&last_update);
    update_UI(tick_time);
}

static void inbox_dropped_callback(AppMessageResult reason, void *context) {
//     APP_LOG(APP_LOG_LEVEL_ERROR, "Message dropped!");
}

static void outbox_failed_callback(DictionaryIterator *iterator, AppMessageResult reason, void *context) {
//     APP_LOG(APP_LOG_LEVEL_ERROR, "Outbox send failed!");
}

static void outbox_sent_callback(DictionaryIterator *iterator, void *context) {
//     APP_LOG(APP_LOG_LEVEL_INFO, "Outbox send success!");
}

static void remove_tap_update() {
    if (update_only_on_tap) {
        remove_tap_update_timer = NULL;
        
        train1_time = 0;
        train2_time = 0;
        train3_time = 0;
        
        // update display
        last_update = time(NULL);
        struct tm *tick_time = localtime(&last_update);
        update_UI(tick_time);
    }
}

static void schedule_remove_tap_update() {
    // schedule an update of train times after initialisation
    if (update_only_on_tap) {
        if (remove_tap_update_timer != NULL) {
            app_timer_cancel(remove_tap_update_timer);
            remove_tap_update_timer = NULL;
        }
        remove_tap_update_timer = app_timer_register(REMOVE_TAP_UPDATE_DELAY_MILLISECONDS, remove_tap_update, NULL);
    }
}

static void tap_handler(AccelAxisType axis, int32_t direction) {
    request_trains_update();
    schedule_remove_tap_update();
}

// static void get_persist_data() {
//     if (persist_read_string(KEY_CURRENT_ORIGIN) {
        
//     }
// }

static void init() {
    // create main Window element and assign to pointer
    s_main_window = window_create();

    // set handlers to manage the elements inside the Window
    window_set_window_handlers(s_main_window, (WindowHandlers) {
        .load = main_window_load,
        .unload = main_window_unload
    });

    // show the Window on the watch, with animated=true
    window_stack_push(s_main_window, true);

    // register with TickTimerService
    tick_timer_service_subscribe(MINUTE_UNIT, tick_handler);
    
    // register Bluetooth connection monitoring
    bluetooth_connection_service_subscribe(bluetooth_connection_callback);
  
    // register callbacks for AppMessage
    app_message_register_inbox_received(inbox_received_callback);
    app_message_register_inbox_dropped(inbox_dropped_callback);
    app_message_register_outbox_failed(outbox_failed_callback);
    app_message_register_outbox_sent(outbox_sent_callback);

    // open AppMessage
    app_message_open(app_message_inbox_size_maximum(), app_message_outbox_size_maximum());
    
    // register callback for tap events
    accel_tap_service_subscribe(tap_handler);
}

static void deinit() {
    window_destroy(s_main_window);
    bluetooth_connection_service_unsubscribe();
    accel_tap_service_unsubscribe();
}

int main(void) {
    init();
    app_event_loop();
    deinit();
}
