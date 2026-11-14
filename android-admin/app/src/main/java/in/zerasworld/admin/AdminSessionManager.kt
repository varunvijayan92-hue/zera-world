package `in`.zerasworld.admin

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

data class UserSession(
    val id: String,
    val fullName: String,
    val email: String,
    val role: String, // ADMIN, MANAGER, SUPPLIER
    val supplierId: String? = null,
    val supplierName: String? = null
)

data class NotificationLogItem(
    val id: String,
    val title: String,
    val body: String,
    val type: String,
    val timestamp: Long
)

class AdminSessionManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("admin_session_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_BASE_URL = "base_url"
        private const val KEY_AUTH_TOKEN = "auth_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_USER_ROLE = "user_role"
        private const val KEY_SUPPLIER_ID = "supplier_id"
        private const val KEY_SUPPLIER_NAME = "supplier_name"
        private const val KEY_FCM_TOKEN = "fcm_token"
        private const val KEY_IS_TOKEN_REGISTERED = "is_token_registered"
        private const val KEY_NOTIF_LOGS = "notif_logs"
    }

    var baseUrl: String
        get() = prefs.getString(KEY_BASE_URL, "http://10.0.2.2:3000") ?: "http://10.0.2.2:3000"
        set(value) = prefs.edit().putString(KEY_BASE_URL, value.trimEnd('/')).apply()

    var authToken: String?
        get() = prefs.getString(KEY_AUTH_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_AUTH_TOKEN, value).apply()

    var fcmToken: String?
        get() = prefs.getString(KEY_FCM_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_FCM_TOKEN, value).apply()

    var isTokenRegistered: Boolean
        get() = prefs.getBoolean(KEY_IS_TOKEN_REGISTERED, false)
        set(value) = prefs.edit().putBoolean(KEY_IS_TOKEN_REGISTERED, value).apply()

    fun saveUser(user: UserSession) {
        prefs.edit()
            .putString(KEY_USER_ID, user.id)
            .putString(KEY_USER_NAME, user.fullName)
            .putString(KEY_USER_EMAIL, user.email)
            .putString(KEY_USER_ROLE, user.role)
            .putString(KEY_SUPPLIER_ID, user.supplierId)
            .putString(KEY_SUPPLIER_NAME, user.supplierName)
            .apply()
    }

    fun getUser(): UserSession? {
        val id = prefs.getString(KEY_USER_ID, null) ?: return null
        val name = prefs.getString(KEY_USER_NAME, "User") ?: "User"
        val email = prefs.getString(KEY_USER_EMAIL, "") ?: ""
        val role = prefs.getString(KEY_USER_ROLE, "ADMIN") ?: "ADMIN"
        val supplierId = prefs.getString(KEY_SUPPLIER_ID, null)
        val supplierName = prefs.getString(KEY_SUPPLIER_NAME, null)
        return UserSession(id, name, email, role, supplierId, supplierName)
    }

    fun isLoggedIn(): Boolean = getUser() != null && !authToken.isNullOrEmpty()

    fun logout() {
        prefs.edit()
            .remove(KEY_AUTH_TOKEN)
            .remove(KEY_USER_ID)
            .remove(KEY_USER_NAME)
            .remove(KEY_USER_EMAIL)
            .remove(KEY_USER_ROLE)
            .remove(KEY_SUPPLIER_ID)
            .remove(KEY_SUPPLIER_NAME)
            .putBoolean(KEY_IS_TOKEN_REGISTERED, false)
            .apply()
    }

    fun addNotificationLog(title: String, body: String, type: String) {
        val logs = getNotificationLogs().toMutableList()
        logs.add(
            0, NotificationLogItem(
                id = System.currentTimeMillis().toString(),
                title = title,
                body = body,
                type = type,
                timestamp = System.currentTimeMillis()
            )
        )
        val jsonArray = JSONArray()
        logs.take(50).forEach { item ->
            val obj = JSONObject().apply {
                put("id", item.id)
                put("title", item.title)
                put("body", item.body)
                put("type", item.type)
                put("timestamp", item.timestamp)
            }
            jsonArray.put(obj)
        }
        prefs.edit().putString(KEY_NOTIF_LOGS, jsonArray.toString()).apply()
    }

    fun getNotificationLogs(): List<NotificationLogItem> {
        val raw = prefs.getString(KEY_NOTIF_LOGS, null) ?: return emptyList()
        val list = mutableListOf<NotificationLogItem>()
        try {
            val jsonArray = JSONArray(raw)
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                list.add(
                    NotificationLogItem(
                        id = obj.optString("id", i.toString()),
                        title = obj.optString("title", "Alert"),
                        body = obj.optString("body", ""),
                        type = obj.optString("type", "GENERAL"),
                        timestamp = obj.optLong("timestamp", System.currentTimeMillis())
                    )
                )
            }
        } catch (_: Exception) {}
        return list
    }

    fun clearNotificationLogs() {
        prefs.edit().remove(KEY_NOTIF_LOGS).apply()
    }
}
