package com.morewax.platform

import android.content.Intent
import android.net.Uri
import com.morewax.android.MoreWaxApplication

actual fun openUrl(url: String) {
    // FLAG_ACTIVITY_NEW_TASK is required when starting an Activity from a non-Activity context
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    MoreWaxApplication.appContext.startActivity(intent)
}
