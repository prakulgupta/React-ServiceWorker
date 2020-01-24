self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', () => {
    self.clients.matchAll({ type: 'window' }).then(windowClients => {
        for (let windowClient of windowClients) {
            // Force open pages to refresh, so that they have a chance to load the
            // fresh navigation response from the local dev server.
            windowClient.navigate(windowClient.url);
        }
    });
});

self.addEventListener('fetch', function (event) {
    event.respondWith(
        caches.match(event.request)
            .then(function (response) {
                // Cache hit - return response
                if (response) {
                    console.log("Response from cache");
                    fetctDataFromApi(event);
                    return response;
                }
                return fetch(event.request).then(
                    function (response) {
                        // Check if we received a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        updateCache(response, event.request.url);
                        console.log("Response from api call")
                        return response;
                    }
                );
            }))
});

function fetctDataFromApi(event) {
    fetch(event.request).then(response => {
        updateCache(response, event.request.url)
        return response.json()
    }
    )
        .then(
            data => {
                if (data) {
                    self.clients.matchAll().then(function (clients) {
                        clients.forEach(function (client) {
                            client.postMessage({
                                "command": "broadcastOnRequest",
                                "message": data
                            });
                        })
                    })
                }
            }
        )
}

self.addEventListener('sync', function (event) {
    if (event.tag.indexOf('weatherforecast') > -1) {
        console.log(`Syncing - ${event.tag}`);
        event.waitUntil(updateWeatherForecast(event.tag));
    }
});

self.addEventListener('message', function (event) {
    var data = event.data;

    if (data.command == "oneWayCommunication") {
        console.log("Message the Page : ", data.message);
    }

    if (data.command == "twoWayCommunication") {
        console.log("Respondingessage from the Page: ", data.message);
        event.ports[0].postMessage({
            "message": "Hi, Page"
        });
    }
});

function updateCache(response, tag) {
    if (response.url.indexOf("weatherforecast") > -1) {
        console.log("Updating Cache");
        // IMPORTANT: Clone the response. A response is a stream
        // and because we want the browser to consume the response
        // as well as the cache consuming the response, we need
        // to clone it so we have two streams.
        var responseToCache = response.clone();

        caches.open("WeatherData")
            .then(function (cache) {
                cache.put(`${tag}`, responseToCache);
            });

    }
}
function updateWeatherForecast(tag) {
    fetch(`https://localhost:44353/${tag}`)
        .then(function (response) {
            updateCache(response, tag);
            return response;
        })
        .catch(function (error) {
            console.log('Request failed', error);
        });
}