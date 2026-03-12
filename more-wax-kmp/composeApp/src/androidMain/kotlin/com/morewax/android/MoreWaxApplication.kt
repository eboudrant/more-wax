package com.morewax.android

import android.app.Application
import android.content.Context

class MoreWaxApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        appContext = applicationContext
    }

    companion object {
        lateinit var appContext: Context
            private set
    }
}
