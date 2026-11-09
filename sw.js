/* Creators Automation — push service worker: new-prompt notifications */
self.addEventListener('push', function(event) {
    var data = {};
    try { data = event.data ? event.data.json() : {}; } catch (e) {}
    var title = data.title || 'Creators Automation';
    var body = data.body || 'A new prompt is live — check it out!';
    var url = data.url || '/';
    event.waitUntil(self.registration.showNotification(title, {
        body: body,
        icon: '/ca-logo-dp.png',
        badge: '/ca-logo-dp.png',
        data: { url: url }
    }));
});
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    var url = (event.notification.data && event.notification.data.url) || '/';
    event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
        for (var i = 0; i < list.length; i++) {
            if ('focus' in list[i]) return list[i].focus();
        }
        if (clients.openWindow) return clients.openWindow(url);
    }));
});
