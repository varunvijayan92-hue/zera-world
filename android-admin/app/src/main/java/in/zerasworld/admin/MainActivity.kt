package `in`.zerasworld.admin

import android.Manifest
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            ZerasAdminTheme {
                AdminAppRoot()
            }
        }
    }
}

@Composable
fun ZerasAdminTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Color(0xFF1E293B),
            secondary = Color(0xFF0F766E),
            tertiary = Color(0xFF2563EB),
            background = Color(0xFFF8FAFC),
            surface = Color.White
        ),
        content = content
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminAppRoot() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val sessionManager = remember { AdminSessionManager(context) }
    val repository = remember { AdminApiRepository(sessionManager) }

    var isLoggedIn by remember { mutableStateOf(sessionManager.isLoggedIn()) }
    var currentUser by remember { mutableStateOf(sessionManager.getUser()) }
    var fcmTokenState by remember { mutableStateOf(sessionManager.fcmToken ?: "Fetching token...") }
    var isTokenRegisteredState by remember { mutableStateOf(sessionManager.isTokenRegistered) }

    var hasNotifPermission by remember {
        mutableStateOf(NotificationPermissionHelper.hasNotificationPermission(context))
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasNotifPermission = granted
        if (granted) {
            Toast.makeText(context, "Notification permission granted!", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(context, "Notification permission denied. Alert notifications may not show.", Toast.LENGTH_LONG).show()
        }
    }

    LaunchedEffect(Unit) {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful && task.result != null) {
                val token = task.result
                sessionManager.fcmToken = token
                fcmTokenState = token
                if (sessionManager.isLoggedIn() && !sessionManager.isTokenRegistered) {
                    scope.launch {
                        when (val result = repository.registerDeviceToken(token)) {
                            is ApiResult.Success -> {
                                isTokenRegisteredState = true
                            }
                            is ApiResult.Error -> {}
                        }
                    }
                }
            } else {
                fcmTokenState = "Failed to fetch FCM Token"
            }
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize()
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            if (!isLoggedIn || currentUser == null) {
                LoginScreen(
                    sessionManager = sessionManager,
                    repository = repository,
                    onLoginSuccess = { user ->
                        currentUser = user
                        isLoggedIn = true
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !hasNotifPermission) {
                            permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        }
                        sessionManager.fcmToken?.let { token ->
                            scope.launch {
                                repository.registerDeviceToken(token)
                                isTokenRegisteredState = sessionManager.isTokenRegistered
                            }
                        }
                    }
                )
            } else {
                DashboardScreen(
                    user = currentUser!!,
                    sessionManager = sessionManager,
                    repository = repository,
                    fcmToken = fcmTokenState,
                    isTokenRegistered = isTokenRegisteredState,
                    hasNotifPermission = hasNotifPermission,
                    onRequestPermission = {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        }
                    },
                    onTokenRegisterClick = {
                        val token = sessionManager.fcmToken
                        if (!token.isNullOrEmpty()) {
                            scope.launch {
                                when (val res = repository.registerDeviceToken(token)) {
                                    is ApiResult.Success -> {
                                        isTokenRegisteredState = true
                                        Toast.makeText(context, "Phone registered for notifications!", Toast.LENGTH_SHORT).show()
                                    }
                                    is ApiResult.Error -> {
                                        Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
                                    }
                                }
                            }
                        }
                    },
                    onLogout = {
                        sessionManager.logout()
                        currentUser = null
                        isLoggedIn = false
                    }
                )
            }
        }
    }
}

@Composable
fun LoginScreen(
    sessionManager: AdminSessionManager,
    repository: AdminApiRepository,
    onLoginSuccess: (UserSession) -> Unit
) {
    var baseUrlInput by remember { mutableStateOf(sessionManager.baseUrl) }
    var loginIdInput by remember { mutableStateOf("") }
    var passwordInput by remember { mutableStateOf("") }
    var isPasswordVisible by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.AdminPanelSettings,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(72.dp)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Zera's World Admin",
            fontSize = 26.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )

        Text(
            text = "Sign in to manage orders & push notifications",
            fontSize = 14.sp,
            color = Color.Gray,
            modifier = Modifier.padding(top = 4.dp, bottom = 24.dp)
        )

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                OutlinedTextField(
                    value = baseUrlInput,
                    onValueChange = { baseUrlInput = it },
                    label = { Text("Website Server URL") },
                    leadingIcon = { Icon(Icons.Default.Language, contentDescription = null) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                OutlinedTextField(
                    value = loginIdInput,
                    onValueChange = { loginIdInput = it },
                    label = { Text("Email or Login ID") },
                    leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                OutlinedTextField(
                    value = passwordInput,
                    onValueChange = { passwordInput = it },
                    label = { Text("Password") },
                    leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                    trailingIcon = {
                        IconButton(onClick = { isPasswordVisible = !isPasswordVisible }) {
                            Icon(
                                imageVector = if (isPasswordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                contentDescription = null
                            )
                        }
                    },
                    visualTransformation = if (isPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                if (!errorMessage.isNullOrEmpty()) {
                    Text(
                        text = errorMessage!!,
                        color = MaterialTheme.colorScheme.error,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    )
                }

                Button(
                    onClick = {
                        if (loginIdInput.isBlank() || passwordInput.isBlank()) {
                            errorMessage = "Please enter login ID and password."
                            return@Button
                        }
                        sessionManager.baseUrl = baseUrlInput
                        isLoading = true
                        errorMessage = null

                        scope.launch {
                            when (val result = repository.login(loginIdInput, passwordInput)) {
                                is ApiResult.Success -> {
                                    isLoading = false
                                    onLoginSuccess(result.data)
                                }
                                is ApiResult.Error -> {
                                    isLoading = false
                                    errorMessage = result.message
                                }
                            }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    enabled = !isLoading,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            color = Color.White,
                            modifier = Modifier.size(24.dp)
                        )
                    } else {
                        Text("Sign In", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    user: UserSession,
    sessionManager: AdminSessionManager,
    repository: AdminApiRepository,
    fcmToken: String,
    isTokenRegistered: Boolean,
    hasNotifPermission: Boolean,
    onRequestPermission: () -> Unit,
    onTokenRegisterClick: () -> Unit,
    onLogout: () -> Unit
) {
    if (user.role == "SUPPLIER") {
        SupplierPortalScreen(
            user = user,
            sessionManager = sessionManager,
            repository = repository,
            fcmToken = fcmToken,
            isTokenRegistered = isTokenRegistered,
            hasNotifPermission = hasNotifPermission,
            onRequestPermission = onRequestPermission,
            onTokenRegisterClick = onTokenRegisterClick,
            onLogout = onLogout
        )
    } else {
        AdminDashboardContent(
            user = user,
            sessionManager = sessionManager,
            repository = repository,
            fcmToken = fcmToken,
            isTokenRegistered = isTokenRegistered,
            hasNotifPermission = hasNotifPermission,
            onRequestPermission = onRequestPermission,
            onTokenRegisterClick = onTokenRegisterClick,
            onLogout = onLogout
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminDashboardContent(
    user: UserSession,
    sessionManager: AdminSessionManager,
    repository: AdminApiRepository,
    fcmToken: String,
    isTokenRegistered: Boolean,
    hasNotifPermission: Boolean,
    onRequestPermission: () -> Unit,
    onTokenRegisterClick: () -> Unit,
    onLogout: () -> Unit
) {
    var navigationGroups by remember { mutableStateOf<List<NavigationGroup>>(emptyList()) }
    var selectedGroupIndex by remember { mutableIntStateOf(0) }
    var selectedSectionId by remember { mutableStateOf("dashboard") }
    var isAlertsView by remember { mutableStateOf(false) }
    var sectionData by remember { mutableStateOf<org.json.JSONObject?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val scope = rememberCoroutineScope()

    fun loadSection(targetSection: String) {
        isLoading = true
        errorMessage = null
        scope.launch {
            if (navigationGroups.isEmpty()) {
                when (val navRes = repository.fetchNavigation()) {
                    is ApiResult.Success -> {
                        navigationGroups = navRes.data.groups
                    }
                    is ApiResult.Error -> {}
                }
            }
            when (val res = repository.fetchAdminSection(targetSection)) {
                is ApiResult.Success -> {
                    sectionData = res.data
                    isLoading = false
                }
                is ApiResult.Error -> {
                    errorMessage = res.message
                    isLoading = false
                }
            }
        }
    }

    LaunchedEffect(selectedSectionId) {
        if (!isAlertsView) {
            loadSection(selectedSectionId)
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                Column {
                    Text("Zera's World Admin", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Text("${user.fullName} (${user.role})", fontSize = 12.sp, color = Color.LightGray)
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = MaterialTheme.colorScheme.primary,
                titleContentColor = Color.White,
                actionIconContentColor = Color.White
            ),
            actions = {
                IconButton(onClick = { isAlertsView = !isAlertsView }) {
                    Icon(
                        imageVector = if (isAlertsView) Icons.Default.Dashboard else Icons.Default.Notifications,
                        contentDescription = if (isAlertsView) "Dashboard" else "Alerts"
                    )
                }
                IconButton(onClick = onLogout) {
                    Icon(Icons.Default.Logout, contentDescription = "Sign Out")
                }
            }
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !hasNotifPermission) {
            Surface(
                color = Color(0xFFFEF3C7),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        modifier = Modifier.weight(1f),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.NotificationsActive,
                            contentDescription = null,
                            tint = Color(0xFFD97706),
                            modifier = Modifier.padding(end = 8.dp)
                        )
                        Text(
                            "Android 13+ requires notification permission to receive push alerts.",
                            fontSize = 13.sp,
                            color = Color(0xFF92400E)
                        )
                    }
                    Button(
                        onClick = onRequestPermission,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD97706)),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text("Allow", fontSize = 12.sp)
                    }
                }
            }
        }

        if (isAlertsView) {
            AlertsTab(
                sessionManager = sessionManager,
                repository = repository,
                fcmToken = fcmToken,
                isTokenRegistered = isTokenRegistered,
                hasNotifPermission = hasNotifPermission,
                onTokenRegisterClick = onTokenRegisterClick
            )
        } else {
            // Group selector tabs
            if (navigationGroups.isNotEmpty()) {
                ScrollableTabRow(
                    selectedTabIndex = selectedGroupIndex.coerceIn(0, navigationGroups.size - 1),
                    edgePadding = 8.dp
                ) {
                    navigationGroups.forEachIndexed { index, group ->
                        Tab(
                            selected = selectedGroupIndex == index,
                            onClick = {
                                selectedGroupIndex = index
                                val firstItem = group.items.firstOrNull()
                                if (firstItem != null) {
                                    selectedSectionId = firstItem.id
                                }
                            },
                            text = { Text(group.label, fontWeight = FontWeight.Bold, fontSize = 13.sp) }
                        )
                    }
                }

                val currentItems = navigationGroups.getOrNull(selectedGroupIndex)?.items ?: emptyList()
                if (currentItems.isNotEmpty()) {
                    ScrollableTabRow(
                        selectedTabIndex = currentItems.indexOfFirst { it.id == selectedSectionId }.coerceAtLeast(0),
                        edgePadding = 8.dp
                    ) {
                        currentItems.forEach { item ->
                            Tab(
                                selected = selectedSectionId == item.id,
                                onClick = { selectedSectionId = item.id },
                                text = { Text(item.label, fontSize = 12.sp) }
                            )
                        }
                    }
                }
            } else {
                ScrollableTabRow(
                    selectedTabIndex = 0,
                    edgePadding = 8.dp
                ) {
                    Tab(selected = true, onClick = {}, text = { Text("Overview") })
                }
            }

            Box(modifier = Modifier.weight(1f).padding(16.dp)) {
                if (isLoading) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                } else if (!errorMessage.isNullOrEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(errorMessage!!, color = Color.Red)
                            Spacer(modifier = Modifier.height(8.dp))
                            Button(onClick = { loadSection(selectedSectionId) }) {
                                Text("Retry")
                            }
                        }
                    }
                } else {
                    SectionDataView(
                        section = selectedSectionId,
                        data = sectionData,
                        role = user.role,
                        repository = repository,
                        accentColor = MaterialTheme.colorScheme.primary,
                        onRefresh = { loadSection(selectedSectionId) }
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupplierPortalScreen(
    user: UserSession,
    sessionManager: AdminSessionManager,
    repository: AdminApiRepository,
    fcmToken: String,
    isTokenRegistered: Boolean,
    hasNotifPermission: Boolean,
    onRequestPermission: () -> Unit,
    onTokenRegisterClick: () -> Unit,
    onLogout: () -> Unit
) {
    var navigationGroups by remember { mutableStateOf<List<NavigationGroup>>(emptyList()) }
    var selectedSection by remember { mutableStateOf("dashboard") }
    var isAlertsView by remember { mutableStateOf(false) }
    var sectionData by remember { mutableStateOf<org.json.JSONObject?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val scope = rememberCoroutineScope()

    fun loadNavigationAndSection(targetSection: String) {
        isLoading = true
        errorMessage = null
        scope.launch {
            if (navigationGroups.isEmpty()) {
                when (val navRes = repository.fetchNavigation()) {
                    is ApiResult.Success -> {
                        navigationGroups = navRes.data.groups
                    }
                    is ApiResult.Error -> {}
                }
            }
            when (val dataRes = repository.fetchSupplierSection(targetSection)) {
                is ApiResult.Success -> {
                    sectionData = dataRes.data
                    isLoading = false
                }
                is ApiResult.Error -> {
                    errorMessage = dataRes.message
                    isLoading = false
                }
            }
        }
    }

    LaunchedEffect(selectedSection) {
        if (!isAlertsView) {
            loadNavigationAndSection(selectedSection)
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                Column {
                    Text(user.supplierName ?: "Supplier Portal", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Text(user.email, fontSize = 12.sp, color = Color.LightGray)
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = MaterialTheme.colorScheme.secondary,
                titleContentColor = Color.White,
                actionIconContentColor = Color.White
            ),
            actions = {
                IconButton(onClick = { isAlertsView = !isAlertsView }) {
                    Icon(
                        imageVector = if (isAlertsView) Icons.Default.Dashboard else Icons.Default.Notifications,
                        contentDescription = if (isAlertsView) "Dashboard" else "Alerts"
                    )
                }
                IconButton(onClick = onLogout) {
                    Icon(Icons.Default.Logout, contentDescription = "Sign Out")
                }
            }
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !hasNotifPermission) {
            Surface(
                color = Color(0xFFFEF3C7),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Enable notifications for order and return alerts.", fontSize = 12.sp, color = Color(0xFF92400E))
                    Button(
                        onClick = onRequestPermission,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD97706)),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text("Allow", fontSize = 12.sp)
                    }
                }
            }
        }

        if (isAlertsView) {
            AlertsTab(
                sessionManager = sessionManager,
                repository = repository,
                fcmToken = fcmToken,
                isTokenRegistered = isTokenRegistered,
                hasNotifPermission = hasNotifPermission,
                onTokenRegisterClick = onTokenRegisterClick
            )
        } else {
            val allNavItems = remember(navigationGroups) {
                if (navigationGroups.isNotEmpty()) {
                    navigationGroups.flatMap { it.items }
                } else {
                    listOf(
                        NavigationItem("dashboard", "Dashboard"),
                        NavigationItem("orders", "Orders"),
                        NavigationItem("products", "Products"),
                        NavigationItem("shipments", "Shipments"),
                        NavigationItem("returns", "Returns"),
                        NavigationItem("profile", "Profile")
                    )
                }
            }

            ScrollableTabRow(
                selectedTabIndex = allNavItems.indexOfFirst { it.id == selectedSection }.coerceAtLeast(0),
                edgePadding = 8.dp
            ) {
                allNavItems.forEach { item ->
                    Tab(
                        selected = selectedSection == item.id,
                        onClick = { selectedSection = item.id },
                        text = { Text(item.label, fontSize = 13.sp) }
                    )
                }
            }

            Box(modifier = Modifier.weight(1f).padding(16.dp)) {
                if (isLoading) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                } else if (!errorMessage.isNullOrEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(errorMessage!!, color = Color.Red)
                            Spacer(modifier = Modifier.height(8.dp))
                            Button(onClick = { loadNavigationAndSection(selectedSection) }) {
                                Text("Retry")
                            }
                        }
                    }
                } else {
                    SectionDataView(
                        section = selectedSection,
                        data = sectionData,
                        role = "SUPPLIER",
                        repository = repository,
                        accentColor = MaterialTheme.colorScheme.secondary,
                        onRefresh = { loadNavigationAndSection(selectedSection) }
                    )
                }
            }
        }
    }
}

sealed class ActionDialogState {
    data class DispatchAwb(val itemId: String) : ActionDialogState()
    data class CollectCod(val orderId: String) : ActionDialogState()
    data class ChangeOrderStatus(val orderId: String, val currentStatus: String) : ActionDialogState()
    data class ReviewReturn(val returnId: String) : ActionDialogState()
    data class UpdateStockCost(val productId: String, val currentStock: Int, val currentCost: Double) : ActionDialogState()
    object AddSupplierProduct : ActionDialogState()
    object AddAdminProduct : ActionDialogState()
    object AddSupplier : ActionDialogState()
    data class RecordSettlement(val supplierId: String, val supplierName: String) : ActionDialogState()
    data class UpdateProductPrice(val productId: String, val currentSelling: Double, val currentCost: Double, val currentStock: Int) : ActionDialogState()
    data class ReplyTicket(val ticketId: String, val subject: String) : ActionDialogState()
    object AddExpense : ActionDialogState()
}

@Composable
fun SectionDataView(
    section: String,
    data: org.json.JSONObject?,
    role: String,
    repository: AdminApiRepository,
    accentColor: Color = MaterialTheme.colorScheme.primary,
    onRefresh: () -> Unit
) {
    if (data == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No section data loaded.", color = Color.Gray)
        }
        return
    }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val actualData = data.opt("data")
    var activeDialog by remember { mutableStateOf<ActionDialogState?>(null) }

    fun runAction(call: suspend () -> ApiResult<String>) {
        scope.launch {
            when (val res = call()) {
                is ApiResult.Success -> {
                    Toast.makeText(context, res.data, Toast.LENGTH_SHORT).show()
                    onRefresh()
                    activeDialog = null
                }
                is ApiResult.Error -> {
                    Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    // Render active dialog
    when (val dialog = activeDialog) {
        is ActionDialogState.DispatchAwb -> {
            var courier by remember { mutableStateOf("Delhivery") }
            var awb by remember { mutableStateOf("") }
            AlertDialog(
                onDismissRequest = { activeDialog = null },
                title = { Text("Dispatch Shipment (AWB)") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Courier Service:", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(
                                selected = courier == "Delhivery",
                                onClick = { courier = "Delhivery" },
                                label = { Text("Delhivery") }
                            )
                            FilterChip(
                                selected = courier == "Shiprocket",
                                onClick = { courier = "Shiprocket" },
                                label = { Text("Shiprocket") }
                            )
                        }
                        OutlinedTextField(
                            value = awb,
                            onValueChange = { awb = it.trim() },
                            label = { Text("AWB Tracking Number") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (awb.length >= 5) {
                                runAction { repository.submitSupplierShipmentAWB(dialog.itemId, awb, courier) }
                            } else {
                                Toast.makeText(context, "Enter a valid AWB number (min 5 chars)", Toast.LENGTH_SHORT).show()
                            }
                        }
                    ) { Text("Dispatch") }
                },
                dismissButton = {
                    TextButton(onClick = { activeDialog = null }) { Text("Cancel") }
                }
            )
        }
        is ActionDialogState.CollectCod -> {
            var ref by remember { mutableStateOf("") }
            AlertDialog(
                onDismissRequest = { activeDialog = null },
                title = { Text("Record COD Collection") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Enter the courier remittance or cash receipt reference number:")
                        OutlinedTextField(
                            value = ref,
                            onValueChange = { ref = it },
                            label = { Text("Receipt / Remittance Reference") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        if (ref.isNotBlank()) {
                            runAction { repository.collectCodPayment(dialog.orderId, ref.trim()) }
                        }
                    }) { Text("Record Paid") }
                },
                dismissButton = {
                    TextButton(onClick = { activeDialog = null }) { Text("Cancel") }
                }
            )
        }
        is ActionDialogState.ChangeOrderStatus -> {
            val statuses = listOf("CONFIRMED", "PROCESSING", "SHIPPED", "CANCELLED")
            var selectedStatus by remember { mutableStateOf(dialog.currentStatus) }
            AlertDialog(
                onDismissRequest = { activeDialog = null },
                title = { Text("Update Order Status") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        statuses.forEach { st ->
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                            ) {
                                RadioButton(selected = selectedStatus == st, onClick = { selectedStatus = st })
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(st, fontWeight = FontWeight.Medium)
                            }
                        }
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        runAction { repository.updateOrderStatus(dialog.orderId, selectedStatus) }
                    }) { Text("Update") }
                },
                dismissButton = {
                    TextButton(onClick = { activeDialog = null }) { Text("Cancel") }
                }
            )
        }
        is ActionDialogState.ReviewReturn -> {
            var decision by remember { mutableStateOf("APPROVED") }
            var notes by remember { mutableStateOf("") }
            AlertDialog(
                onDismissRequest = { activeDialog = null },
                title = { Text("Review Return Request") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Decision:", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            listOf("APPROVED", "REJECTED", "RECEIVED").forEach { d ->
                                FilterChip(
                                    selected = decision == d,
                                    onClick = { decision = d },
                                    label = { Text(d, fontSize = 11.sp) }
                                )
                            }
                        }
                        OutlinedTextField(
                            value = notes,
                            onValueChange = { notes = it },
                            label = { Text("Admin Notes") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        runAction { repository.reviewReturn(dialog.returnId, decision, notes) }
                    }) { Text("Submit") }
                },
                dismissButton = {
                    TextButton(onClick = { activeDialog = null }) { Text("Cancel") }
                }
            )
        }
        is ActionDialogState.UpdateStockCost -> {
            var stockStr by remember { mutableStateOf(dialog.currentStock.toString()) }
            var costStr by remember { mutableStateOf(dialog.currentCost.toString()) }
            AlertDialog(
                onDismissRequest = { activeDialog = null },
                title = { Text("Update Stock & Cost") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = stockStr,
                            onValueChange = { stockStr = it },
                            label = { Text("Available Stock") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = costStr,
                            onValueChange = { costStr = it },
                            label = { Text("Cost Price (₹)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        val stock = stockStr.toIntOrNull() ?: 0
                        val cost = costStr.toDoubleOrNull() ?: 0.0
                        runAction { repository.updateSupplierStock(dialog.productId, stock, cost) }
                    }) { Text("Save") }
                },
                dismissButton = {
                    TextButton(onClick = { activeDialog = null }) { Text("Cancel") }
                }
            )
        }
        is ActionDialogState.AddSupplierProduct -> {
            var name by remember { mutableStateOf("") }
            var sku by remember { mutableStateOf("") }
            var costStr by remember { mutableStateOf("") }
            var stockStr by remember { mutableStateOf("0") }
            var desc by remember { mutableStateOf("") }
            AlertDialog(
                onDismissRequest = { activeDialog = null },
                title = { Text("Add New Product (Draft)") },
                text = {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        item {
                            OutlinedTextField(
                                value = name,
                                onValueChange = { name = it },
                                label = { Text("Product Name") },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        item {
                            OutlinedTextField(
                                value = sku,
                                onValueChange = { sku = it },
                                label = { Text("SKU Code") },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        item {
                            OutlinedTextField(
                                value = costStr,
                                onValueChange = { costStr = it },
                                label = { Text("Purchase / Cost Price (₹)") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        item {
                            OutlinedTextField(
                                value = stockStr,
                                onValueChange = { stockStr = it },
                                label = { Text("Opening Stock Quantity") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        item {
                            OutlinedTextField(
                                value = desc,
                                onValueChange = { desc = it },
                                label = { Text("Description") },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        if (name.isNotBlank() && sku.isNotBlank()) {
                            val cost = costStr.toDoubleOrNull() ?: 0.0
                            val stock = stockStr.toIntOrNull() ?: 0
                            runAction { repository.createSupplierProduct(name, sku, desc, cost, stock) }
                        } else {
                            Toast.makeText(context, "Name and SKU are required.", Toast.LENGTH_SHORT).show()
                        }
                    }) { Text("Submit Draft") }
                },
                dismissButton = {
                    TextButton(onClick = { activeDialog = null }) { Text("Cancel") }
                }
            )
        }
        is ActionDialogState.UpdateProductPrice -> {
            var sellingStr by remember { mutableStateOf(dialog.currentSelling.toString()) }
            var costStr by remember { mutableStateOf(dialog.currentCost.toString()) }
            var stockStr by remember { mutableStateOf(dialog.currentStock.toString()) }
            AlertDialog(
                onDismissRequest = { activeDialog = null },
                title = { Text("Edit Product Price & Stock") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = sellingStr,
                            onValueChange = { sellingStr = it },
                            label = { Text("Selling Price (₹)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = costStr,
                            onValueChange = { costStr = it },
                            label = { Text("Cost Price (₹)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = stockStr,
                            onValueChange = { stockStr = it },
                            label = { Text("Available Stock") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        val selling = sellingStr.toDoubleOrNull()
                        val cost = costStr.toDoubleOrNull()
                        val stock = stockStr.toIntOrNull()
                        runAction { repository.updateProductPricingAndStock(dialog.productId, selling, cost, stock) }
                    }) { Text("Save") }
                },
                dismissButton = {
                    TextButton(onClick = { activeDialog = null }) { Text("Cancel") }
                }
            )
        }
        is ActionDialogState.ReplyTicket -> {
            var replyText by remember { mutableStateOf("") }
            var ticketStatus by remember { mutableStateOf("RESOLVED") }
            AlertDialog(
                onDismissRequest = { activeDialog = null },
                title = { Text("Reply to Support Ticket") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Subject: ${dialog.subject}", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        OutlinedTextField(
                            value = replyText,
                            onValueChange = { replyText = it },
                            label = { Text("Reply Message") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(
                                selected = ticketStatus == "RESOLVED",
                                onClick = { ticketStatus = "RESOLVED" },
                                label = { Text("RESOLVED") }
                            )
                            FilterChip(
                                selected = ticketStatus == "CLOSED",
                                onClick = { ticketStatus = "CLOSED" },
                                label = { Text("CLOSED") }
                            )
                        }
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        if (replyText.isNotBlank()) {
                            runAction { repository.replyToSupportTicket(dialog.ticketId, replyText, ticketStatus) }
                        }
                    }) { Text("Send") }
                },
                dismissButton = {
                    TextButton(onClick = { activeDialog = null }) { Text("Cancel") }
                }
            )
        }
        is ActionDialogState.AddExpense -> {
            var category by remember { mutableStateOf("Operations") }
            var amountStr by remember { mutableStateOf("") }
            var desc by remember { mutableStateOf("") }
            AlertDialog(
                onDismissRequest = { activeDialog = null },
                title = { Text("Record Expense Voucher") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = category,
                            onValueChange = { category = it },
                            label = { Text("Expense Category") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = amountStr,
                            onValueChange = { amountStr = it },
                            label = { Text("Amount (₹)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = desc,
                            onValueChange = { desc = it },
                            label = { Text("Description / Payee") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        val amount = amountStr.toDoubleOrNull() ?: 0.0
                        if (amount > 0) {
                            runAction { repository.createExpense(category, amount, desc) }
                        } else {
                            Toast.makeText(context, "Enter a valid positive amount.", Toast.LENGTH_SHORT).show()
                        }
                    }) { Text("Save Voucher") }
                },
                dismissButton = {
                    TextButton(onClick = { activeDialog = null }) { Text("Cancel") }
                }
            )
        }
        is ActionDialogState.AddAdminProduct -> {
            var name by remember { mutableStateOf("") }
            var sku by remember { mutableStateOf("") }
            var category by remember { mutableStateOf("General") }
            var sellingStr by remember { mutableStateOf("") }
            var costStr by remember { mutableStateOf("") }
            var stockStr by remember { mutableStateOf("0") }
            var desc by remember { mutableStateOf("") }
            var status by remember { mutableStateOf("ACTIVE") }
            AlertDialog(
                onDismissRequest = { activeDialog = null },
                title = { Text("Create New Product") },
                text = {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        item {
                            OutlinedTextField(
                                value = name,
                                onValueChange = { name = it },
                                label = { Text("Product Name") },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        item {
                            OutlinedTextField(
                                value = sku,
                                onValueChange = { sku = it },
                                label = { Text("SKU Code") },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        item {
                            OutlinedTextField(
                                value = category,
                                onValueChange = { category = it },
                                label = { Text("Category") },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        item {
                            OutlinedTextField(
                                value = sellingStr,
                                onValueChange = { sellingStr = it },
                                label = { Text("Selling Price (₹)") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        item {
                            OutlinedTextField(
                                value = costStr,
                                onValueChange = { costStr = it },
                                label = { Text("Cost Price (₹)") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        item {
                            OutlinedTextField(
                                value = stockStr,
                                onValueChange = { stockStr = it },
                                label = { Text("Opening Stock") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        item {
                            OutlinedTextField(
                                value = desc,
                                onValueChange = { desc = it },
                                label = { Text("Description") },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        item {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                FilterChip(
                                    selected = status == "ACTIVE",
                                    onClick = { status = "ACTIVE" },
                                    label = { Text("ACTIVE") }
                                )
                                FilterChip(
                                    selected = status == "DRAFT",
                                    onClick = { status = "DRAFT" },
                                    label = { Text("DRAFT") }
                                )
                            }
                        }
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        if (name.isNotBlank() && sku.isNotBlank()) {
                            val selling = sellingStr.toDoubleOrNull() ?: 0.0
                            val cost = costStr.toDoubleOrNull() ?: 0.0
                            val stock = stockStr.toIntOrNull() ?: 0
                            runAction {
                                repository.createAdminProduct(
                                    name = name.trim(),
                                    sku = sku.trim(),
                                    category = category.trim(),
                                    sellingPrice = selling,
                                    costPrice = cost,
                                    stock = stock,
                                    description = desc.trim(),
                                    hsnCode = null,
                                    status = status
                                )
                            }
                        } else {
                            Toast.makeText(context, "Name and SKU are required.", Toast.LENGTH_SHORT).show()
                        }
                    }) { Text("Create Product") }
                },
                dismissButton = {
                    TextButton(onClick = { activeDialog = null }) { Text("Cancel") }
                }
            )
        }
        is ActionDialogState.AddSupplier -> {
            var companyName by remember { mutableStateOf("") }
            var contactName by remember { mutableStateOf("") }
            var email by remember { mutableStateOf("") }
            var phone by remember { mutableStateOf("") }
            var sourceType by remember { mutableStateOf("DIRECT") }
            var pickupAddress by remember { mutableStateOf("") }
            var gstNumber by remember { mutableStateOf("") }
            AlertDialog(
                onDismissRequest = { activeDialog = null },
                title = { Text("Create New Supplier") },
                text = {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        item {
                            OutlinedTextField(
                                value = companyName,
                                onValueChange = { companyName = it },
                                label = { Text("Company / Brand Name") },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        item {
                            OutlinedTextField(
                                value = contactName,
                                onValueChange = { contactName = it },
                                label = { Text("Contact Person Name") },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        item {
                            OutlinedTextField(
                                value = email,
                                onValueChange = { email = it },
                                label = { Text("Supplier Email") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        item {
                            OutlinedTextField(
                                value = phone,
                                onValueChange = { phone = it },
                                label = { Text("Phone Number") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        item {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                FilterChip(
                                    selected = sourceType == "DIRECT",
                                    onClick = { sourceType = "DIRECT" },
                                    label = { Text("DIRECT") }
                                )
                                FilterChip(
                                    selected = sourceType == "EXTERNAL_SITE",
                                    onClick = { sourceType = "EXTERNAL_SITE" },
                                    label = { Text("EXTERNAL_SITE") }
                                )
                            }
                        }
                        item {
                            OutlinedTextField(
                                value = pickupAddress,
                                onValueChange = { pickupAddress = it },
                                label = { Text("Pickup Address") },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                        item {
                            OutlinedTextField(
                                value = gstNumber,
                                onValueChange = { gstNumber = it },
                                label = { Text("GST Number (optional)") },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        if (companyName.isNotBlank()) {
                            runAction {
                                repository.createSupplier(
                                    companyName = companyName.trim(),
                                    contactName = contactName.trim(),
                                    email = email.trim(),
                                    phone = phone.trim(),
                                    sourceType = sourceType,
                                    pickupAddress = pickupAddress.trim(),
                                    gstNumber = gstNumber.trim()
                                )
                            }
                        } else {
                            Toast.makeText(context, "Company name is required.", Toast.LENGTH_SHORT).show()
                        }
                    }) { Text("Create Supplier") }
                },
                dismissButton = {
                    TextButton(onClick = { activeDialog = null }) { Text("Cancel") }
                }
            )
        }
        is ActionDialogState.RecordSettlement -> {
            var amountStr by remember { mutableStateOf("") }
            var reference by remember { mutableStateOf("") }
            var notes by remember { mutableStateOf("") }
            AlertDialog(
                onDismissRequest = { activeDialog = null },
                title = { Text("Record Supplier Settlement") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Supplier: ${dialog.supplierName}", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        OutlinedTextField(
                            value = amountStr,
                            onValueChange = { amountStr = it },
                            label = { Text("Settlement Amount (₹)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = reference,
                            onValueChange = { reference = it },
                            label = { Text("Bank / UTR Reference") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = notes,
                            onValueChange = { notes = it },
                            label = { Text("Notes (optional)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        val amount = amountStr.toDoubleOrNull() ?: 0.0
                        if (amount > 0 && reference.isNotBlank()) {
                            runAction {
                                repository.recordSupplierSettlement(
                                    supplierId = dialog.supplierId,
                                    amount = amount,
                                    reference = reference.trim(),
                                    notes = notes.trim()
                                )
                            }
                        } else {
                            Toast.makeText(context, "Amount and reference are required.", Toast.LENGTH_SHORT).show()
                        }
                    }) { Text("Record Settlement") }
                },
                dismissButton = {
                    TextButton(onClick = { activeDialog = null }) { Text("Cancel") }
                }
            )
        }
        null -> {}
    }

    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Section: ${section.replace("-", " ").uppercase()}",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = accentColor
                )

                // Top context action buttons
                if (section == "products") {
                    Button(
                        onClick = {
                            activeDialog = if (role == "SUPPLIER") ActionDialogState.AddSupplierProduct else ActionDialogState.AddAdminProduct
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = accentColor),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Add Product", fontSize = 12.sp)
                    }
                } else if (section in listOf("suppliers", "sellers") && role != "SUPPLIER") {
                    Button(
                        onClick = { activeDialog = ActionDialogState.AddSupplier },
                        colors = ButtonDefaults.buttonColors(containerColor = accentColor),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Add Supplier", fontSize = 12.sp)
                    }
                } else if (section == "profit-expenses" && role != "SUPPLIER") {
                    Button(
                        onClick = { activeDialog = ActionDialogState.AddExpense },
                        colors = ButtonDefaults.buttonColors(containerColor = accentColor),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Add Expense", fontSize = 12.sp)
                    }
                }
            }
        }

        if (actualData is org.json.JSONObject) {
            // Profit and Loss Card (if present in accounts or profit-expenses)
            val pnl = actualData.optJSONObject("profitAndLoss")
            if (pnl != null) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC)),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Profit & Loss Statement (P&L)", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = MaterialTheme.colorScheme.primary)
                                val net = pnl.optDouble("netProfitOrLoss", 0.0)
                                Surface(
                                    color = if (net >= 0) Color(0xFFDCFCE7) else Color(0xFFFEE2E2),
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text(
                                        text = if (net >= 0) "+₹${String.format(java.util.Locale.US, "%.2f", net)}" else "-₹${String.format(java.util.Locale.US, "%.2f", -net)}",
                                        color = if (net >= 0) Color(0xFF15803D) else Color(0xFFB91C1C),
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(10.dp))
                            Divider(color = Color(0xFFE2E8F0))
                            Spacer(modifier = Modifier.height(8.dp))

                            val pnlRows = listOf(
                                "Gross Revenue (Sales)" to pnl.optDouble("grossRevenue", 0.0),
                                "Product Costs (COGS)" to -pnl.optDouble("productCostsCOGS", 0.0),
                                "Logistics & Shipping Costs" to -pnl.optDouble("shippingCosts", 0.0),
                                "Operating Expenses" to -pnl.optDouble("operatingExpenses", 0.0),
                                "Customer Refunds" to -pnl.optDouble("refunds", 0.0),
                                "GST Liability" to -pnl.optDouble("gstLiability", 0.0)
                            )
                            pnlRows.forEach { (label, amt) ->
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(label, fontSize = 12.sp, color = Color.DarkGray)
                                    Text(
                                        text = if (amt >= 0) "₹${String.format(java.util.Locale.US, "%.2f", amt)}" else "-₹${String.format(java.util.Locale.US, "%.2f", -amt)}",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = if (amt >= 0) Color.Black else Color(0xFFDC2626)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            val keys = actualData.keys().asSequence().filter { it != "profitAndLoss" && it != "transactions" && it != "expenses" }.toList()
            val metricKeys = keys.filter { key ->
                val v = actualData.opt(key)
                (v is Number || (v is String && v.all { it.isDigit() })) && key.contains("Count", ignoreCase = true) ||
                        key in listOf("orderLines", "products", "shipments", "returns", "pendingOrders", "confirmedOrders", "deliveredOrders", "totalRevenue")
            }

            if (metricKeys.isNotEmpty()) {
                val chunks = metricKeys.chunked(2)
                chunks.forEach { chunk ->
                    item {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            chunk.forEach { k ->
                                MetricCard(
                                    label = k.replace(Regex("([a-z])([A-Z])"), "$1 $2").replaceFirstChar { it.uppercase() },
                                    value = actualData.optString(k, "0"),
                                    accentColor = accentColor,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                            if (chunk.size == 1) {
                                Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
            }

            val otherKeys = keys.filter { it !in metricKeys }
            if (otherKeys.isNotEmpty()) {
                items(otherKeys) { key ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                key.replace(Regex("([a-z])([A-Z])"), "$1 $2").replaceFirstChar { it.uppercase() },
                                fontSize = 13.sp,
                                color = Color.Gray
                            )
                            Text(actualData.optString(key, "-"), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }
                }
            }

            // If nested transactions or expenses list exist in JSONObject
            val subArray = actualData.optJSONArray("transactions") ?: actualData.optJSONArray("expenses")
            if (subArray != null && subArray.length() > 0) {
                item {
                    Text(
                        text = if (actualData.has("transactions")) "Recent Transactions" else "Recorded Vouchers",
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
                items((0 until subArray.length()).toList()) { index ->
                    val itemObj = subArray.getJSONObject(index)
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            itemObj.keys().forEach { key ->
                                val value = itemObj.opt(key)
                                if (value != null && value != org.json.JSONObject.NULL) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(key.replace(Regex("([a-z])([A-Z])"), "$1 $2").replaceFirstChar { it.uppercase() }, fontSize = 12.sp, color = Color.Gray)
                                        Text(value.toString(), fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else if (actualData is org.json.JSONArray) {
            if (actualData.length() == 0) {
                item {
                    Text("No records found in this section.", color = Color.Gray)
                }
            } else {
                items((0 until actualData.length()).toList()) { index ->
                    val itemObj = actualData.getJSONObject(index)
                    val recordId = itemObj.optString("id", "")
                    val recordStatus = itemObj.optString("status", itemObj.optString("fulfillmentStatus", ""))

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            itemObj.keys().forEach { key ->
                                val value = itemObj.opt(key)
                                if (value != null && value != org.json.JSONObject.NULL && key != "orderItems") {
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(
                                            key.replace(Regex("([a-z])([A-Z])"), "$1 $2").replaceFirstChar { it.uppercase() },
                                            fontSize = 12.sp,
                                            color = Color.Gray,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                        Text(
                                            text = value.toString(),
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = Color.Black
                                        )
                                    }
                                }
                            }

                            // Dynamic Action Rows for both Supplier & Admin
                            if (recordId.isNotEmpty()) {
                                Spacer(modifier = Modifier.height(8.dp))
                                Divider(color = Color(0xFFF1F5F9))
                                Spacer(modifier = Modifier.height(8.dp))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    if (role == "SUPPLIER") {
                                        // SUPPLIER ACTIONS
                                        if (section in listOf("orders", "notifications")) {
                                            if (recordStatus != "ACCEPTED" && recordStatus != "PACKED" && recordStatus != "SHIPPED") {
                                                OutlinedButton(
                                                    onClick = { runAction { repository.updateSupplierOrderFulfillment(recordId, "ACCEPTED") } },
                                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                                    modifier = Modifier.weight(1f)
                                                ) { Text("Accept", fontSize = 11.sp) }
                                            }
                                            if (recordStatus == "ACCEPTED" || recordStatus == "PROCESSING") {
                                                Button(
                                                    onClick = { runAction { repository.updateSupplierOrderFulfillment(recordId, "PACKED") } },
                                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                                    modifier = Modifier.weight(1f)
                                                ) { Text("Pack", fontSize = 11.sp) }
                                            }
                                            if (recordStatus == "PACKED") {
                                                Button(
                                                    onClick = { activeDialog = ActionDialogState.DispatchAwb(recordId) },
                                                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary),
                                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                                    modifier = Modifier.weight(1f)
                                                ) { Text("Ship AWB", fontSize = 11.sp) }
                                            }
                                        } else if (section == "returns") {
                                            val supplierReceived = itemObj.optString("supplierReceivedAt", "").isNotEmpty()
                                            if (!supplierReceived) {
                                                Button(
                                                    onClick = { runAction { repository.confirmSupplierReturnReceived(recordId) } },
                                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                                    modifier = Modifier.weight(1f)
                                                ) { Text("Confirm Received", fontSize = 11.sp) }
                                            }
                                        } else if (section == "products") {
                                            val stock = itemObj.optInt("availableQty", itemObj.optJSONObject("inventory")?.optInt("availableQty", 0) ?: 0)
                                            val cost = itemObj.optDouble("costPrice", 0.0)
                                            Button(
                                                onClick = { activeDialog = ActionDialogState.UpdateStockCost(recordId, stock, cost) },
                                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                                modifier = Modifier.weight(1f)
                                            ) { Text("Update Stock", fontSize = 11.sp) }
                                        }
                                    } else {
                                        // ADMIN & MANAGER ACTIONS
                                        if (section == "orders") {
                                            if (recordStatus != "DELIVERED" && recordStatus != "CANCELLED") {
                                                Button(
                                                    onClick = { runAction { repository.confirmOrderDelivery(recordId) } },
                                                    contentPadding = PaddingValues(horizontal = 6.dp, vertical = 4.dp),
                                                    modifier = Modifier.weight(1f)
                                                ) { Text("Delivered", fontSize = 11.sp) }
                                            }
                                            OutlinedButton(
                                                onClick = { activeDialog = ActionDialogState.CollectCod(recordId) },
                                                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 4.dp),
                                                modifier = Modifier.weight(1f)
                                            ) { Text("Collect COD", fontSize = 11.sp) }
                                            OutlinedButton(
                                                onClick = { activeDialog = ActionDialogState.ChangeOrderStatus(recordId, recordStatus) },
                                                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 4.dp),
                                                modifier = Modifier.weight(1f)
                                            ) { Text("Status", fontSize = 11.sp) }
                                        } else if (section == "returns") {
                                            Button(
                                                onClick = { activeDialog = ActionDialogState.ReviewReturn(recordId) },
                                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                                modifier = Modifier.weight(1f)
                                            ) { Text("Review Return", fontSize = 11.sp) }
                                        } else if (section == "products") {
                                            val currentStatus = itemObj.optString("status", "DRAFT")
                                            val nextStatus = if (currentStatus == "ACTIVE") "DRAFT" else "ACTIVE"
                                            OutlinedButton(
                                                onClick = { runAction { repository.updateProductStatus(recordId, nextStatus) } },
                                                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 4.dp),
                                                modifier = Modifier.weight(1f)
                                            ) { Text(if (currentStatus == "ACTIVE") "Deactivate" else "Activate", fontSize = 10.sp) }
                                            val selling = itemObj.optDouble("sellingPrice", 0.0)
                                            val cost = itemObj.optDouble("costPrice", 0.0)
                                            val stock = itemObj.optInt("availableQty", 0)
                                            Button(
                                                onClick = { activeDialog = ActionDialogState.UpdateProductPrice(recordId, selling, cost, stock) },
                                                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 4.dp),
                                                modifier = Modifier.weight(1f)
                                            ) { Text("Edit Price", fontSize = 10.sp) }
                                        } else if (section == "users") {
                                            val isActive = itemObj.optBoolean("isActive", true)
                                            Button(
                                                onClick = { runAction { repository.toggleUserStatus(recordId, !isActive) } },
                                                colors = ButtonDefaults.buttonColors(containerColor = if (isActive) Color(0xFFDC2626) else Color(0xFF16A34A)),
                                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                                modifier = Modifier.weight(1f)
                                            ) { Text(if (isActive) "Deactivate" else "Activate", fontSize = 11.sp) }
                                        } else if (section in listOf("contact-messages", "support")) {
                                            val subject = itemObj.optString("subject", "Inquiry")
                                            Button(
                                                onClick = { activeDialog = ActionDialogState.ReplyTicket(recordId, subject) },
                                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                                modifier = Modifier.weight(1f)
                                            ) { Text("Reply", fontSize = 11.sp) }
                                        } else if (section in listOf("suppliers", "sellers")) {
                                            val company = itemObj.optString("companyName", "Supplier")
                                            Button(
                                                onClick = { activeDialog = ActionDialogState.RecordSettlement(recordId, company) },
                                                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 4.dp),
                                                modifier = Modifier.weight(1f)
                                            ) { Text("Settlement", fontSize = 10.sp) }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else {
            item {
                Text(actualData?.toString() ?: "No content", fontSize = 13.sp)
            }
        }
    }
}

@Composable
fun MetricCard(label: String, value: String, accentColor: Color, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(label, fontSize = 13.sp, color = Color.Gray)
            Spacer(modifier = Modifier.height(4.dp))
            Text(value, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = accentColor)
        }
    }
}

@Composable
fun AlertsTab(
    sessionManager: AdminSessionManager,
    repository: AdminApiRepository,
    fcmToken: String,
    isTokenRegistered: Boolean,
    hasNotifPermission: Boolean,
    onTokenRegisterClick: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var notificationLogs by remember { mutableStateOf(sessionManager.getNotificationLogs()) }
    var isSendingTestAlert by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Firebase Notification Setup", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Spacer(modifier = Modifier.height(8.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = if (isTokenRegistered) Icons.Default.CheckCircle else Icons.Default.Warning,
                            contentDescription = null,
                            tint = if (isTokenRegistered) Color(0xFF16A34A) else Color(0xFFEAB308),
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (isTokenRegistered) "Registered on Server" else "Not Registered on Server",
                            fontWeight = FontWeight.SemiBold,
                            color = if (isTokenRegistered) Color(0xFF16A34A) else Color(0xFFCA8A04)
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Text("FCM Token:", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.Gray)
                    Text(
                        text = fcmToken,
                        fontSize = 11.sp,
                        color = Color.DarkGray,
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFFF1F5F9), RoundedCornerShape(4.dp))
                            .padding(8.dp)
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = onTokenRegisterClick,
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.Sync, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Register Token", fontSize = 12.sp)
                        }

                        Button(
                            onClick = {
                                isSendingTestAlert = true
                                scope.launch {
                                    when (val res = repository.sendTestAlert("ORDER_ALERT")) {
                                        is ApiResult.Success -> {
                                            isSendingTestAlert = false
                                            Toast.makeText(context, res.data, Toast.LENGTH_SHORT).show()
                                            notificationLogs = sessionManager.getNotificationLogs()
                                        }
                                        is ApiResult.Error -> {
                                            isSendingTestAlert = false
                                            Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
                                        }
                                    }
                                }
                            },
                            enabled = !isSendingTestAlert,
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Test Order Alert", fontSize = 12.sp)
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Button(
                        onClick = {
                            isSendingTestAlert = true
                            scope.launch {
                                when (val res = repository.sendTestAlert("RETURN_ALERT")) {
                                    is ApiResult.Success -> {
                                        isSendingTestAlert = false
                                        Toast.makeText(context, res.data, Toast.LENGTH_SHORT).show()
                                        notificationLogs = sessionManager.getNotificationLogs()
                                    }
                                    is ApiResult.Error -> {
                                        isSendingTestAlert = false
                                        Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
                                    }
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary),
                        enabled = !isSendingTestAlert,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Test Return Request Alert", fontSize = 12.sp)
                    }
                }
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Received Push Alerts Log", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                if (notificationLogs.isNotEmpty()) {
                    TextButton(onClick = {
                        sessionManager.clearNotificationLogs()
                        notificationLogs = emptyList()
                    }) {
                        Text("Clear Log", fontSize = 12.sp, color = Color.Red)
                    }
                }
            }
        }

        if (notificationLogs.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("No push alerts received yet.", color = Color.Gray)
                }
            }
        } else {
            items(notificationLogs) { log ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = when (log.type) {
                                "ORDER_ALERT" -> Icons.Default.ShoppingCart
                                "RETURN_ALERT" -> Icons.Default.AssignmentReturn
                                else -> Icons.Default.Notifications
                            },
                            contentDescription = null,
                            tint = when (log.type) {
                                "ORDER_ALERT" -> MaterialTheme.colorScheme.tertiary
                                "RETURN_ALERT" -> MaterialTheme.colorScheme.secondary
                                else -> MaterialTheme.colorScheme.primary
                            },
                            modifier = Modifier.size(28.dp)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(log.title, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text(log.body, fontSize = 13.sp, color = Color.DarkGray)
                            Text(
                                SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault()).format(Date(log.timestamp)),
                                fontSize = 10.sp,
                                color = Color.Gray,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun OrdersTab(repository: AdminApiRepository) {
    var ordersList by remember { mutableStateOf<List<AdminOrder>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val scope = rememberCoroutineScope()

    fun loadOrders() {
        isLoading = true
        errorMessage = null
        scope.launch {
            when (val res = repository.fetchOrders()) {
                is ApiResult.Success -> {
                    ordersList = res.data
                    isLoading = false
                }
                is ApiResult.Error -> {
                    errorMessage = res.message
                    isLoading = false
                }
            }
        }
    }

    LaunchedEffect(Unit) {
        loadOrders()
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Admin Orders", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            IconButton(onClick = { loadOrders() }) {
                Icon(Icons.Default.Refresh, contentDescription = "Refresh Orders")
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (!errorMessage.isNullOrEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(errorMessage!!, color = Color.Red)
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(onClick = { loadOrders() }) {
                        Text("Retry")
                    }
                }
            }
        } else if (ordersList.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No orders found.", color = Color.Gray)
            }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(ordersList) { order ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Order #${order.marketplaceOrderId}", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                StatusBadge(status = order.status)
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("Customer: ${order.customerName}", fontSize = 13.sp, color = Color.DarkGray)
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("${order.itemsCount} Items", fontSize = 12.sp, color = Color.Gray)
                                Text("₹${order.totalAmount}", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = MaterialTheme.colorScheme.primary)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ReturnsTab(repository: AdminApiRepository) {
    var returnsList by remember { mutableStateOf<List<AdminReturn>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val scope = rememberCoroutineScope()

    fun loadReturns() {
        isLoading = true
        errorMessage = null
        scope.launch {
            when (val res = repository.fetchReturns()) {
                is ApiResult.Success -> {
                    returnsList = res.data
                    isLoading = false
                }
                is ApiResult.Error -> {
                    errorMessage = res.message
                    isLoading = false
                }
            }
        }
    }

    LaunchedEffect(Unit) {
        loadReturns()
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Return Requests", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            IconButton(onClick = { loadReturns() }) {
                Icon(Icons.Default.Refresh, contentDescription = "Refresh Returns")
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (!errorMessage.isNullOrEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(errorMessage!!, color = Color.Red)
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(onClick = { loadReturns() }) {
                        Text("Retry")
                    }
                }
            }
        } else if (returnsList.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No return requests.", color = Color.Gray)
            }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(returnsList) { item ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Return ID #${item.id.takeLast(6)}", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                StatusBadge(status = item.status)
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("Reason: ${item.reason}", fontSize = 13.sp, color = Color.DarkGray)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("Refund Amount: ₹${item.refundAmount}", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = MaterialTheme.colorScheme.secondary)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun StatusBadge(status: String) {
    val bgColor = when (status.uppercase()) {
        "DELIVERED", "COMPLETED", "APPROVED" -> Color(0xFFDCFCE7)
        "SHIPPED", "CONFIRMED" -> Color(0xFFDBEAFE)
        "PENDING", "OPEN" -> Color(0xFFFEF9C3)
        "CANCELLED", "REJECTED" -> Color(0xFFFEE2E2)
        else -> Color(0xFFF1F5F9)
    }

    val textColor = when (status.uppercase()) {
        "DELIVERED", "COMPLETED", "APPROVED" -> Color(0xFF15803D)
        "SHIPPED", "CONFIRMED" -> Color(0xFF1D4ED8)
        "PENDING", "OPEN" -> Color(0xFFA16207)
        "CANCELLED", "REJECTED" -> Color(0xFFB91C1C)
        else -> Color(0xFF475569)
    }

    Surface(
        color = bgColor,
        shape = RoundedCornerShape(12.dp)
    ) {
        Text(
            text = status,
            color = textColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}
