package `in`.zerasworld.admin.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import `in`.zerasworld.admin.AdminApiRepository
import `in`.zerasworld.admin.AdminSessionManager
import `in`.zerasworld.admin.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MyFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "FCMAdminService"
        const val CHANNEL_ID = "admin_alerts_channel"
        const val CHANNEL_NAME = "Admin Orders & Returns Alerts"
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "New FCM Token received: $token")
        val sessionManager = AdminSessionManager(applicationContext)
        sessionManager.fcmToken = token
        sessionManager.isTokenRegistered = false

        if (sessionManager.isLoggedIn()) {
            CoroutineScope(Dispatchers.IO).launch {
                val repository = AdminApiRepository(sessionManager)
                repository.registerDeviceToken(token)
            }
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d(TAG, "From: ${remoteMessage.from}")

        val data = remoteMessage.data
        val notif = remoteMessage.notification

        val title = notif?.title ?: data["title"] ?: "Admin Alert"
        val body = notif?.body ?: data["body"] ?: "You have a new admin notification."
        val type = data["type"] ?: data["alertType"] ?: "GENERAL"
        val orderId = data["orderId"]
        val returnId = data["returnId"]

        val sessionManager = AdminSessionManager(applicationContext)
        sessionManager.addNotificationLog(title, body, type)

        showNotification(title, body, type, orderId, returnId)
    }

    private fun showNotification(
        title: String,
        body: String,
        type: String,
        orderId: String?,
        returnId: String?
    ) {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("EXTRA_NOTIF_TYPE", type)
            if (!orderId.isNullOrEmpty()) putExtra("EXTRA_ORDER_ID", orderId)
            if (!returnId.isNullOrEmpty()) putExtra("EXTRA_RETURN_ID", returnId)
        }

        val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            System.currentTimeMillis().toInt(),
            intent,
            pendingIntentFlags
        )

        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val notificationBuilder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Push notifications for new orders, order status updates, and return requests."
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val notificationId = (System.currentTimeMillis() % 10000).toInt()
        notificationManager.notify(notificationId, notificationBuilder.build())
    }
}
