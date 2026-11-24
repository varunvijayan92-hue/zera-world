package `in`.zerasworld.admin

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

private const val inboxPath = "/api/mobile/admin/inbox"

@Composable
fun AdminInboxTab(repository: AdminApiRepository) {
    var tab by remember { mutableStateOf("") }
    var thread by remember { mutableStateOf("") }
    var messages by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var draft by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var refresh by remember { mutableIntStateOf(0) }
    var replyId by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun open(next: String) {
        messages = emptyList()
        draft = ""
        error = ""
        status = ""
        replyId = null
        loading = true
        thread = next
    }

    LaunchedEffect(thread, tab, refresh) {
        while (true) {
            val query = when {
                thread.isNotEmpty() -> "?thread=$thread"
                tab.isNotEmpty() -> "?channel=$tab"
                else -> ""
            }
            when (val result = repository.requestMobileApi(inboxPath + query)) {
                is ApiResult.Success -> {
                    val rows = runCatching { JSONObject(result.data).getJSONArray("data") }.getOrNull()
                    if (rows == null) error = "Inbox response could not be read."
                    else messages = (0 until rows.length()).mapNotNull { rows.optJSONObject(it) }
                }
                is ApiResult.Error -> error = result.message
            }
            loading = false
            delay(15000)
        }
    }

    val incoming = messages.lastOrNull { it.optString("direction") == "INBOUND" }
    val closed = incoming != null && incoming.optString("channel") == "WHATSAPP" && runCatching {
        Instant.parse(incoming.optString("createdAt")).plusSeconds(86400).isBefore(Instant.now())
    }.getOrDefault(true)

    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (thread.isEmpty()) {
                listOf("" to "All", "EMAIL" to "Email", "WHATSAPP" to "WhatsApp").forEach { (value, label) ->
                    FilterChip(selected = tab == value, enabled = !busy, onClick = {
                        if (tab != value) { tab = value; open("") }
                    }, label = { Text(label) })
                }
            } else {
                OutlinedButton(enabled = !busy, onClick = { open("") }) { Text("Conversations") }
            }
            TextButton(enabled = !busy, onClick = { error = ""; refresh++ }) { Text("Refresh") }
        }
        if (error.isNotEmpty()) Text(error, color = MaterialTheme.colorScheme.error)
        if (status.isNotEmpty()) Text(status)
        if (messages.isEmpty()) Text(if (loading) "Loading…" else "No messages yet.")
        LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(messages, key = { it.optString("id") }) { item ->
                val peer = item.optString("peer")
                val email = item.optString("channel") == "EMAIL"
                val subject = if (item.isNull("subject")) "" else item.optString("subject")
                if (thread.isEmpty()) {
                    OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = { open(item.optString("thread")) }) {
                        Column(Modifier.fillMaxWidth()) {
                            Text(subject.ifBlank { if (email) peer else "+$peer" })
                            Text(if (email) "Email · $peer" else "WhatsApp · +$peer")
                            Text(item.optString("body"), maxLines = 2)
                        }
                    }
                } else {
                    Card(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(12.dp)) {
                            val outgoing = item.optString("direction") == "OUTBOUND"
                            Text(if (outgoing) "Support · ${item.optString("status").lowercase()}" else if (email) peer else "+$peer")
                            Text(item.optString("body"))
                        }
                    }
                }
            }
        }
        if (thread.isNotEmpty() && incoming != null) {
            if (closed) Text("The WhatsApp reply window reopens when the customer sends a new message.")
            else {
                OutlinedTextField(value = draft, onValueChange = {
                    if (it.length <= 4096) { draft = it; replyId = null }
                }, enabled = !busy, label = { Text("Reply") }, modifier = Modifier.fillMaxWidth(), maxLines = 4)
                Button(enabled = !busy && draft.isNotBlank(), onClick = {
                    busy = true
                    error = ""
                    status = ""
                    val id = replyId ?: UUID.randomUUID().toString().also { replyId = it }
                    val payload = JSONObject().put("thread", thread).put("replyId", id).put("body", draft)
                    scope.launch {
                        when (val result = repository.requestMobileApi(inboxPath, "POST", payload)) {
                            is ApiResult.Success -> { draft = ""; replyId = null; status = "Reply accepted by the provider." }
                            is ApiResult.Error -> error = result.message
                        }
                        busy = false
                        refresh++
                    }
                }) { Text(if (busy) "Sending…" else "Send reply") }
            }
        }
    }
}
