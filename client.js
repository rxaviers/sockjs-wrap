'use strict';

function reconnectHandler(connection, options) {
    var rTimeout;
    options = options.reconnect || {};
    options = {
        factor: options.factor || 2,
        delay: options.delay || [500, 30000]
    };
    var delay = options.delay[0];

    var runReconnect = function() {
        connection.start.apply(connection, connection.lastStartArgs);
        delay = Math.min(delay * options.factor, options.delay[1]);
        rTimeout = setTimeout(runReconnect, delay);
    };

    connection.on('close', function() {
        if (!rTimeout) {
          rTimeout = setTimeout(runReconnect, delay);
        }
    });

    connection.on('connect', function() {
        clearTimeout(rTimeout);
        delay = options.delay[0];
    });
}

/**
 * @constructor
 */

var Connection = function (options) {
    options = options || {};
    this._sockjs = null;
    this._pointer = 1;
    this._events = {};
    this._loggingContext = console ? console : {};

    reconnectHandler(this, options);
};

/**
 * Start the Connection and add the listeners
 *
 * @param {SockJS} SockJS | Required
 * @param {object} options | Required
 */

Connection.prototype.start = function (SockJS, options) {
    // Setup basic options
    options = options || {};
    options = {
      url           : options.url,
      logging       : options.logging        || function(){},
      loggingContext: options.loggingContext || this._loggingContext // Fix for logging in chrome
    };

    this.lastStartArgs = [ SockJS, options ];

    // Check for valid logging function
    if( 'function' !== typeof options.logging) {
        options.logging = function(){}
    }

    // Check if SockJS is loaded, either in the HTML or passed as instance
    if( 'function' !== typeof SockJS ) {
        options.logging.call(options.loggingContext, 'Connection :: error :: SockJS is undefined');
        this.internalEmit('failure');
        return;
    }

    // Add http:// || https:// if its not already there
    if( 'http' !== options.url.substr(0, 4) ) {
        var protocol = window.location.protocol + '//' || 'http://';
        options.url = protocol + options.url;
    }

    // Start socket connection with SockJS
    options.logging.call(options.loggingContext, 'Connection :: Starting socket interface on: ' + options.url);
    this._sockjs = new SockJS(options.url);
    var self = this;

    // Handle connection open event
    this._sockjs.onopen = function () {
        self.internalEmit('connect');
    };

    // Handle connection closed event
    this._sockjs.onclose = function () {
        self.internalEmit('close');
    };

    // Handle message events
    this._sockjs.onmessage = function (raw_message) {
        // Parse message
        try {
            var message = JSON.parse(raw_message.data);
        } catch (error) {
            options.logging.call(options.loggingContext, "Connection :: Error parsing message: ", error);
            return;
        }

        // Check for type
        if (!message.hasOwnProperty('type')) {
            options.logging.call(options.loggingContext, "Connection :: Invalid message: no type specified :: ", message);
            return;
        }

        // Check for bundles
        if('bundle' === message.type) {
            for( var i = 0; i < message.data.length; i ++ ) {
                var bundleItem = message.data[i];
                if(!bundleItem.hasOwnProperty('data')) {
                    bundleItem.data = {};
                }

                if(bundleItem.hasOwnProperty('type')) {
                    self.internalEmit(bundleItem.type, bundleItem.data);
                }
            }
        }
        else {
            // Emit the message
            self.internalEmit(message.type, message.data);
        }
    };

};

/**
 * Send data to the server
 *
 * @param {string} type
 * @param {object} data
 */

Connection.prototype.emit = function (type, data) {
    var _data = {type: type, data: data};
    this._sockjs.send(JSON.stringify(_data));
};

/**
 * Disconnect the connection
 */
Connection.prototype.disconnect = function() {
    if(this._sockjs._transport && this._sockjs._transport.ws) {
        this._sockjs._transport.ws.onclose();
    }
};

/**
 * Event system
 * @param {string} event
 * @param {function} cb
 */

Connection.prototype.on = function(event, cb) {
    if( ! this._events.hasOwnProperty(event) ) {
        this._events[event] = [];
    }
    this._events[event].push(cb);
};

/**
 * Event system
 * @param event
 */
Connection.prototype.internalEmit = function(event) {
    var args = Array.prototype.slice.call(arguments).slice(1);

    if( this._events.hasOwnProperty(event) ) {
        var events = this._events[event];
        for ( var key in events ) {
            if(events.hasOwnProperty(key)) {
                events[key].apply(null, args);
            }
        }
    }
};

/**
 * Export to the window or as module export based on environment
 */
(function (factory){
    if(typeof exports === 'object') {
        module.exports = exports = factory;
    } else {
        window.Connection = factory;
    }
})(Connection);
