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
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.Image
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// Exact website design tokens from zerasworld.in
val ForestGreen = Color(0xFF173B35)
val ForestDeep = Color(0xFF0F2A26)
val LuxuryGold = Color(0xFFB38A45)
val IvoryBg = Color(0xFFF7F4ED)
val SageGreen = Color(0xFF8EA695)
val InkColor = Color(0xFF1D2A28)
val MutedText = Color(0xFF5E6D6A)
val CardBorder = Color(0x1F173B35)

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
            primary = ForestGreen,
            secondary = ForestDeep,
            tertiary = LuxuryGold,
            background = IvoryBg,
            surface = Color.White,
            onPrimary = Color.White,
            onSecondary = Color.White,
            onBackground = ForestGreen,
            onSurface = ForestGreen
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
            Toast.makeText(context, "Notification permission denied.", Toast.LENGTH_LONG).show()
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
                        when (repository.registerDeviceToken(token)) {
                            is ApiResult.Success -> isTokenRegisteredState = true
                            is ApiResult.Error -> {}
                        }
                    }
                }
            } else {
                fcmTokenState = "Failed to fetch FCM Token"
            }
        }
    }

    Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(IvoryBg)
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
                val role = currentUser!!.role.uppercase()
                if (role == "SUPPLIER") {
                    SupplierDashboardScreen(
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
                                            Toast.makeText(context, "Supplier device registered for push alerts!", Toast.LENGTH_SHORT).show()
                                        }
                                        is ApiResult.Error -> Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
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
                } else {
                    AdminDashboardScreen(
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
                                            Toast.makeText(context, "Admin device registered for push alerts!", Toast.LENGTH_SHORT).show()
                                        }
                                        is ApiResult.Error -> Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
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
}

@Composable
fun LoginScreen(
    sessionManager: AdminSessionManager,
    repository: AdminApiRepository,
    onLoginSuccess: (UserSession) -> Unit
) {
    var selectedPortal by remember { mutableStateOf("ADMIN") } // ADMIN or SUPPLIER
    var loginIdInput by remember { mutableStateOf("") }
    var passwordInput by remember { mutableStateOf("") }
    var isPasswordVisible by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val scope = rememberCoroutineScope()

    Box(
        modifier = Modifier.fillMaxSize().safeDrawingPadding().imePadding(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 440.dp)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Official Zera's World Brand Logo
            Image(
                painter = painterResource(id = R.drawable.zera_logo),
                contentDescription = "Zera's World Logo",
                modifier = Modifier
                    .fillMaxWidth(0.85f)
                    .height(96.dp)
                    .padding(bottom = 12.dp),
                contentScale = ContentScale.Fit
            )

            Surface(
                color = LuxuryGold.copy(alpha = 0.15f),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.padding(top = 4.dp, bottom = 20.dp)
            ) {
                Text(
                    text = "STORE & SUPPLIER PORTAL",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForestGreen,
                    letterSpacing = 1.5.sp,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp)
                )
            }

            TabRow(
                selectedTabIndex = if (selectedPortal == "ADMIN") 0 else 1,
                containerColor = Color.White,
                contentColor = ForestGreen,
                modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                indicator = { tabPositions ->
                    TabRowDefaults.SecondaryIndicator(
                        Modifier.tabIndicatorOffset(tabPositions[if (selectedPortal == "ADMIN") 0 else 1]),
                        color = ForestGreen
                    )
                }
            ) {
                Tab(
                    selected = selectedPortal == "ADMIN",
                    onClick = { selectedPortal = "ADMIN" },
                    text = { Text("Admin Portal", fontWeight = if (selectedPortal == "ADMIN") FontWeight.Bold else FontWeight.Medium) },
                    icon = { Icon(Icons.Default.Security, contentDescription = null, tint = if (selectedPortal == "ADMIN") ForestGreen else MutedText) }
                )
                Tab(
                    selected = selectedPortal == "SUPPLIER",
                    onClick = { selectedPortal = "SUPPLIER" },
                    text = { Text("Supplier Portal", fontWeight = if (selectedPortal == "SUPPLIER") FontWeight.Bold else FontWeight.Medium) },
                    icon = { Icon(Icons.Default.LocalShipping, contentDescription = null, tint = if (selectedPortal == "SUPPLIER") ForestGreen else MutedText) }
                )
            }

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, CardBorder),
                shape = RoundedCornerShape(16.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = if (selectedPortal == "ADMIN") "Administrator Sign In" else "Supplier Account Sign In",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForestGreen
                    )

                    OutlinedTextField(
                        value = loginIdInput,
                        onValueChange = { loginIdInput = it },
                        label = { Text("Email or login ID") },
                        leadingIcon = { Icon(Icons.Default.Person, contentDescription = null, tint = ForestGreen) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(10.dp)
                    )

                    OutlinedTextField(
                        value = passwordInput,
                        onValueChange = { passwordInput = it },
                        label = { Text("Password") },
                        leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = ForestGreen) },
                        trailingIcon = {
                            IconButton(onClick = { isPasswordVisible = !isPasswordVisible }) {
                                Icon(
                                    imageVector = if (isPasswordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    contentDescription = if (isPasswordVisible) "Hide password" else "Show password",
                                    tint = MutedText
                                )
                            }
                        },
                        visualTransformation = if (isPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(10.dp)
                    )

                    if (!errorMessage.isNullOrEmpty()) {
                        Surface(
                            color = Color(0xFFFEE2E2),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = errorMessage!!,
                                color = Color(0xFFB91C1C),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.padding(10.dp)
                            )
                        }
                    }

                    Button(
                        onClick = {
                            if (loginIdInput.isBlank() || passwordInput.isBlank()) {
                                errorMessage = "Please enter login ID and password."
                                return@Button
                            }
                            sessionManager.baseUrl = "https://zerasworld.in"
                            isLoading = true
                            errorMessage = null

                            scope.launch {
                                when (val result = repository.login(selectedPortal, loginIdInput, passwordInput)) {
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
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = ForestGreen, contentColor = Color.White)
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(22.dp))
                        } else {
                            Text(
                                "Sign In (${if (selectedPortal == "ADMIN") "Admin" else "Supplier"})",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}

fun getNavIcon(id: String): ImageVector {
    return when (id) {
        "dashboard" -> Icons.Default.Dashboard
        "analytics" -> Icons.Default.Timeline
        "orders" -> Icons.Default.ShoppingCart
        "products" -> Icons.Default.Inventory
        "notifications" -> Icons.Default.Notifications
        "contact-messages", "support" -> Icons.Default.SupportAgent
        "customers", "local-customers" -> Icons.Default.People
        "inventory" -> Icons.Default.Warehouse
        "returns" -> Icons.Default.AssignmentReturn
        "sellers" -> Icons.Default.Storefront
        "categories" -> Icons.Default.Category
        "suppliers" -> Icons.Default.Group
        "fulfillment", "shipments" -> Icons.Default.LocalShipping
        "product-sync" -> Icons.Default.Sync
        "tracking" -> Icons.Default.LocationOn
        "accounts", "payments" -> Icons.Default.AccountBalance
        "gift-cards" -> Icons.Default.CardGiftcard
        "invoices" -> Icons.Default.Receipt
        "profit-expenses", "reports" -> Icons.Default.AttachMoney
        "settings", "profile", "company-profile", "pickup-address" -> Icons.Default.Settings
        "users" -> Icons.Default.SupervisedUserCircle
        else -> Icons.Default.Apps
    }
}

@Composable
fun AdminNoticeCard(text: String) {
    Surface(
        color = Color(0xFFFEF9C3).copy(alpha = 0.6f),
        border = BorderStroke(1.dp, Color(0xFFCA8A04).copy(alpha = 0.3f)),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.Top) {
            Icon(Icons.Default.Info, contentDescription = null, tint = Color(0xFFA16207), modifier = Modifier.size(18.dp).padding(top = 2.dp))
            Spacer(modifier = Modifier.width(10.dp))
            Text(text, fontSize = 12.sp, color = Color(0xFF78350F), lineHeight = 17.sp)
        }
    }
}

@Composable
fun KpiCard(title: String, value: String, icon: ImageVector, color: Color, modifier: Modifier, detail: String? = null) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, CardBorder),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(title.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MutedText, letterSpacing = 0.5.sp)
                Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(value, fontSize = 22.sp, fontWeight = FontWeight.Black, color = ForestGreen)
            if (!detail.isNullOrBlank()) {
                Text(detail, fontSize = 11.sp, color = MutedText, modifier = Modifier.padding(top = 2.dp))
            }
        }
    }
}

@Composable
fun StatusBadge(status: String) {
    val (bgColor, textColor) = when (status.uppercase()) {
        "DELIVERED", "COMPLETED", "APPROVED", "ACCEPTED" -> Color(0xFFDCFCE7) to Color(0xFF15803D)
        "SHIPPED", "CONFIRMED", "PROCESSING", "IN_TRANSIT" -> Color(0xFFDBEAFE) to Color(0xFF1D4ED8)
        "PENDING", "OPEN", "DRAFT", "AWAITING" -> Color(0xFFFEF9C3) to Color(0xFFA16207)
        "CANCELLED", "REJECTED", "FAILED" -> Color(0xFFFEE2E2) to Color(0xFFB91C1C)
        else -> Color(0xFFF1F5F9) to Color(0xFF475569)
    }

    Surface(color = bgColor, shape = RoundedCornerShape(12.dp)) {
        Text(
            text = status,
            color = textColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}

// -------------------------------------------------------------
// ADMIN PORTAL
// -------------------------------------------------------------

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminDashboardScreen(
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
    val scope = rememberCoroutineScope()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    var navData by remember { mutableStateOf(repository.getDefaultNavigation("ADMIN")) }
    var currentSection by remember { mutableStateOf("dashboard") }
    var currentSectionLabel by remember { mutableStateOf("Dashboard") }

    LaunchedEffect(Unit) {
        when (val res = repository.fetchNavigation()) {
            is ApiResult.Success -> navData = res.data
            is ApiResult.Error -> {}
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = Color.White,
                modifier = Modifier.widthIn(max = 310.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(ForestGreen, ForestDeep)
                            )
                        )
                        .padding(20.dp)
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.zera_logo_white),
                        contentDescription = "Zera's World",
                        modifier = Modifier
                            .fillMaxWidth(0.85f)
                            .height(46.dp)
                            .padding(bottom = 6.dp),
                        contentScale = ContentScale.Fit,
                        alignment = Alignment.CenterStart
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(
                            color = LuxuryGold,
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text("ADMIN", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(user.fullName, color = Color.White.copy(alpha = 0.9f), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    }
                    if (user.email.isNotBlank()) {
                        Text(user.email, color = Color.White.copy(alpha = 0.65f), fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
                    }
                }

                HorizontalDivider(color = CardBorder)

                LazyColumn(
                    modifier = Modifier.weight(1f).padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    navData.groups.forEach { group ->
                        item {
                            Text(
                                text = group.label.uppercase(),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = MutedText,
                                letterSpacing = 1.sp,
                                modifier = Modifier.padding(start = 12.dp, top = 14.dp, bottom = 4.dp)
                            )
                        }
                        items(group.items) { item ->
                            val isSelected = currentSection == item.id
                            NavigationDrawerItem(
                                icon = {
                                    Icon(
                                        getNavIcon(item.id),
                                        contentDescription = null,
                                        tint = if (isSelected) Color.White else ForestGreen
                                    )
                                },
                                label = {
                                    Text(
                                        item.label,
                                        fontSize = 13.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                                    )
                                },
                                selected = isSelected,
                                onClick = {
                                    currentSection = item.id
                                    currentSectionLabel = item.label
                                    scope.launch { drawerState.close() }
                                },
                                modifier = Modifier.padding(vertical = 1.dp),
                                shape = RoundedCornerShape(10.dp),
                                colors = NavigationDrawerItemDefaults.colors(
                                    selectedContainerColor = ForestGreen,
                                    selectedTextColor = Color.White,
                                    unselectedContainerColor = Color.Transparent,
                                    unselectedTextColor = ForestGreen
                                )
                            )
                        }
                    }
                }

                HorizontalDivider(color = CardBorder)
                NavigationDrawerItem(
                    icon = { Icon(Icons.Default.Logout, contentDescription = null, tint = Color(0xFFDC2626)) },
                    label = { Text("Sign Out", color = Color(0xFFDC2626), fontSize = 14.sp, fontWeight = FontWeight.Bold) },
                    selected = false,
                    onClick = onLogout,
                    modifier = Modifier.padding(10.dp)
                )
            }
        }
    ) {
        Column(modifier = Modifier.fillMaxSize().background(IvoryBg)) {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = { scope.launch { drawerState.open() } }) {
                        Icon(Icons.Default.Menu, contentDescription = "Menu", tint = ForestGreen)
                    }
                },
                title = {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Image(
                                painter = painterResource(id = R.drawable.zera_logo),
                                contentDescription = "Zera's World",
                                modifier = Modifier.height(26.dp),
                                contentScale = ContentScale.Fit
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("· $currentSectionLabel", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MutedText, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        Text("${user.fullName} (${user.role.lowercase()})", fontSize = 11.sp, color = MutedText)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.White,
                    titleContentColor = ForestGreen,
                    navigationIconContentColor = ForestGreen,
                    actionIconContentColor = ForestGreen
                ),
                actions = {
                    if (currentSection != "notifications") {
                        IconButton(onClick = { currentSection = "notifications"; currentSectionLabel = "Notifications" }) {
                            Icon(Icons.Default.Notifications, contentDescription = "Alerts")
                        }
                    }
                    IconButton(onClick = onLogout) {
                        Icon(Icons.Default.Logout, contentDescription = "Sign Out")
                    }
                }
            )

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !hasNotifPermission) {
                Surface(color = Color(0xFFFEF3C7), modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Android 13+ requires notification permission for FCM alerts.", fontSize = 12.sp, color = Color(0xFF92400E))
                        Button(onClick = onRequestPermission, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD97706))) {
                            Text("Allow", fontSize = 11.sp)
                        }
                    }
                }
            }

            Box(modifier = Modifier.weight(1f)) {
                when (currentSection) {
                    "dashboard" -> AdminSummaryTab(repository = repository, onNavigate = { id, label -> currentSection = id; currentSectionLabel = label })
                    "orders" -> OrdersTab(repository = repository)
                    "products" -> ProductsTab(repository = repository)
                    "suppliers" -> SuppliersTab(repository = repository)
                    "returns" -> ReturnsTab(repository = repository)
                    "notifications" -> AlertsTab(sessionManager = sessionManager, repository = repository, fcmToken = fcmToken, isTokenRegistered = isTokenRegistered, onTokenRegisterClick = onTokenRegisterClick)
                    else -> AdminGenericSectionTab(repository = repository, sectionId = currentSection, sectionTitle = currentSectionLabel)
                }
            }
        }
    }
}

@Composable
fun AdminSummaryTab(repository: AdminApiRepository, onNavigate: (String, String) -> Unit) {
    var ordersCount by remember { mutableIntStateOf(0) }
    var totalRevenue by remember { mutableDoubleStateOf(0.0) }
    var productsCount by remember { mutableIntStateOf(0) }
    var suppliersCount by remember { mutableIntStateOf(0) }
    var returnsCount by remember { mutableIntStateOf(0) }
    var isLoading by remember { mutableStateOf(true) }

    val scope = rememberCoroutineScope()

    fun loadData() {
        isLoading = true
        scope.launch {
            val ordersRes = repository.fetchOrders()
            val productsRes = repository.fetchProducts()
            val suppliersRes = repository.fetchSuppliers()
            val returnsRes = repository.fetchReturns()

            if (ordersRes is ApiResult.Success) {
                ordersCount = ordersRes.data.size
                totalRevenue = ordersRes.data.sumOf { it.totalAmount }
            }
            if (productsRes is ApiResult.Success) productsCount = productsRes.data.size
            if (suppliersRes is ApiResult.Success) suppliersCount = suppliersRes.data.size
            if (returnsRes is ApiResult.Success) returnsCount = returnsRes.data.size
            isLoading = false
        }
    }

    LaunchedEffect(Unit) { loadData() }

    if (isLoading) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = ForestGreen) }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Store Administration Summary", fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = ForestGreen)
                    IconButton(onClick = { loadData() }) { Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = ForestGreen) }
                }
            }
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    KpiCard("Total Orders", ordersCount.toString(), Icons.Default.ShoppingCart, ForestGreen, Modifier.weight(1f), "All customer orders")
                    KpiCard("Revenue", "₹${"%.2f".format(totalRevenue)}", Icons.Default.AttachMoney, Color(0xFF16A34A), Modifier.weight(1f), "Gross sales total")
                }
            }
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    KpiCard("Active Products", productsCount.toString(), Icons.Default.Inventory, Color(0xFF0F766E), Modifier.weight(1f), "Catalog items")
                    KpiCard("Suppliers", suppliersCount.toString(), Icons.Default.Group, LuxuryGold, Modifier.weight(1f), "Active partners")
                }
            }
            item {
                KpiCard("Return Requests", returnsCount.toString(), Icons.Default.AssignmentReturn, Color(0xFFDC2626), Modifier.fillMaxWidth(), "Awaiting refund & warehouse receipt")
            }
            item {
                AdminNoticeCard("Live data synchronized with zerasworld.in production database. Changes in orders or inventory reflect immediately across website and mobile portals.")
            }
            item {
                Text("Management Shortcuts", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = ForestGreen, modifier = Modifier.padding(top = 8.dp))
            }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { onNavigate("orders", "Orders") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, ForestGreen)
                    ) {
                        Icon(Icons.Default.ShoppingCart, contentDescription = null, tint = ForestGreen, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Manage Customer Orders & Delivery", color = ForestGreen, fontWeight = FontWeight.Bold)
                    }
                    OutlinedButton(
                        onClick = { onNavigate("products", "Products") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, ForestGreen)
                    ) {
                        Icon(Icons.Default.Inventory, contentDescription = null, tint = ForestGreen, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Manage Products & Adjust Stock", color = ForestGreen, fontWeight = FontWeight.Bold)
                    }
                    OutlinedButton(
                        onClick = { onNavigate("returns", "Returns & RTO") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, ForestGreen)
                    ) {
                        Icon(Icons.Default.AssignmentReturn, contentDescription = null, tint = ForestGreen, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Process Returns & Issue Refunds", color = ForestGreen, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun OrdersTab(repository: AdminApiRepository) {
    var ordersList by remember { mutableStateOf<List<AdminOrder>>(emptyList()) }
    var selectedFilter by remember { mutableStateOf("ALL") }
    var isLoading by remember { mutableStateOf(true) }
    var actionMessage by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    fun loadOrders() {
        isLoading = true
        scope.launch {
            when (val res = repository.fetchOrders()) {
                is ApiResult.Success -> { ordersList = res.data; isLoading = false }
                is ApiResult.Error -> { isLoading = false }
            }
        }
    }

    LaunchedEffect(Unit) { loadOrders() }

    val filteredOrders = if (selectedFilter == "ALL") ordersList else ordersList.filter { it.status.equals(selectedFilter, ignoreCase = true) }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Admin Customer Orders", fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = ForestGreen)
            IconButton(onClick = { loadOrders() }) { Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = ForestGreen) }
        }

        // Filter chips matching website table filters
        LazyRow(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            val filters = listOf("ALL", "PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED")
            items(filters) { f ->
                FilterChip(
                    selected = selectedFilter == f,
                    onClick = { selectedFilter = f },
                    label = { Text(f, fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = ForestGreen,
                        selectedLabelColor = Color.White
                    )
                )
            }
        }

        if (!actionMessage.isNullOrEmpty()) {
            Surface(
                color = ForestGreen.copy(alpha = 0.1f),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)
            ) {
                Row(modifier = Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(actionMessage!!, fontSize = 12.sp, color = ForestGreen, fontWeight = FontWeight.Medium)
                }
            }
        }

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = ForestGreen) }
        } else if (filteredOrders.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("No orders found in $selectedFilter.", color = MutedText) }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(filteredOrders) { order ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, CardBorder),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text("Order #${order.marketplaceOrderId}", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = ForestGreen)
                                StatusBadge(status = order.status)
                            }
                            Text("Customer: ${order.customerName}", fontSize = 13.sp, color = InkColor)
                            Text("Placed on: ${order.createdAt.take(10)}", fontSize = 11.sp, color = MutedText)

                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("${order.itemsCount} line items", fontSize = 12.sp, color = MutedText)
                                Text("₹${order.totalAmount}", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = ForestGreen)
                            }

                            // Order Actions matching website: Confirm Delivery & Delete Pending
                            HorizontalDivider(color = CardBorder)
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                if (order.status != "DELIVERED" && order.status != "CANCELLED") {
                                    Button(
                                        onClick = {
                                            scope.launch {
                                                when (val res = repository.confirmAdminOrderDelivery(order.id)) {
                                                    is ApiResult.Success -> {
                                                        actionMessage = res.data
                                                        Toast.makeText(context, res.data, Toast.LENGTH_SHORT).show()
                                                        loadOrders()
                                                    }
                                                    is ApiResult.Error -> Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
                                                }
                                            }
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = ForestGreen),
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(8.dp),
                                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 6.dp)
                                    ) {
                                        Text("Confirm Delivery", fontSize = 12.sp)
                                    }
                                }

                                if (order.status == "PENDING") {
                                    OutlinedButton(
                                        onClick = {
                                            scope.launch {
                                                when (val res = repository.deleteAdminPendingOrder(order.id)) {
                                                    is ApiResult.Success -> {
                                                        actionMessage = res.data
                                                        Toast.makeText(context, res.data, Toast.LENGTH_SHORT).show()
                                                        loadOrders()
                                                    }
                                                    is ApiResult.Error -> Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
                                                }
                                            }
                                        },
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFDC2626)),
                                        border = BorderStroke(1.dp, Color(0xFFDC2626)),
                                        shape = RoundedCornerShape(8.dp),
                                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 6.dp)
                                    ) {
                                        Text("Delete Pending", fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ProductsTab(repository: AdminApiRepository) {
    var products by remember { mutableStateOf<List<AdminProduct>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var editingProduct by remember { mutableStateOf<AdminProduct?>(null) }
    var stockInput by remember { mutableStateOf("") }

    var showAddDialog by remember { mutableStateOf(false) }
    var newName by remember { mutableStateOf("") }
    var newSku by remember { mutableStateOf("") }
    var newPrice by remember { mutableStateOf("") }
    var newMrp by remember { mutableStateOf("") }
    var newCost by remember { mutableStateOf("") }
    var newStock by remember { mutableStateOf("0") }
    var newCategory by remember { mutableStateOf("") }
    var newBrand by remember { mutableStateOf("") }
    var newSize by remember { mutableStateOf("") }
    var newColor by remember { mutableStateOf("") }
    var newHsn by remember { mutableStateOf("") }
    var newDeliveryCharge by remember { mutableStateOf("") }
    var newImageUrl by remember { mutableStateOf("") }
    var newDescription by remember { mutableStateOf("") }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    fun load() {
        isLoading = true
        scope.launch {
            when (val res = repository.fetchProducts()) {
                is ApiResult.Success -> { products = res.data; isLoading = false }
                is ApiResult.Error -> { isLoading = false }
            }
        }
    }

    LaunchedEffect(Unit) { load() }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Store Products Catalog", fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = ForestGreen)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Button(
                    onClick = { showAddDialog = true },
                    colors = ButtonDefaults.buttonColors(containerColor = ForestGreen),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Product", fontSize = 12.sp)
                }
                IconButton(onClick = { load() }) { Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = ForestGreen) }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = ForestGreen) }
        } else if (products.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("No products found.", color = MutedText) }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(products) { item ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, CardBorder),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(item.name, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = ForestGreen, modifier = Modifier.weight(1f))
                                StatusBadge(status = item.status)
                            }
                            Text("SKU: ${item.sku} • Category: ${item.category}", fontSize = 12.sp, color = MutedText)
                            Row(modifier = Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Available: ${item.availableQty} units", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = InkColor)
                                Text("Price: ₹${item.sellingPrice}", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = ForestGreen)
                            }

                            Row(modifier = Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.End) {
                                OutlinedButton(
                                    onClick = { editingProduct = item; stockInput = item.availableQty.toString() },
                                    shape = RoundedCornerShape(8.dp),
                                    border = BorderStroke(1.dp, ForestGreen),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                ) {
                                    Icon(Icons.Default.Edit, contentDescription = null, tint = ForestGreen, modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Adjust Stock", fontSize = 12.sp, color = ForestGreen)
                                }
                            }
                        }
                    }
                }
            }
        }

        // Add Product Dialog (Full feature set)
        if (showAddDialog) {
            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("Add New Product", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = ForestGreen) },
                text = {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text("Basic Product Details", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = ForestGreen)

                        OutlinedTextField(
                            value = newName,
                            onValueChange = { newName = it },
                            label = { Text("Product Name *") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = newSku,
                            onValueChange = { newSku = it },
                            label = { Text("SKU Code *") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = newCategory,
                                onValueChange = { newCategory = it },
                                label = { Text("Category") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                            OutlinedTextField(
                                value = newBrand,
                                onValueChange = { newBrand = it },
                                label = { Text("Brand") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                        }

                        HorizontalDivider(color = CardBorder, modifier = Modifier.padding(vertical = 4.dp))
                        Text("Pricing, Tax & Inventory", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = ForestGreen)

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = newPrice,
                                onValueChange = { newPrice = it },
                                label = { Text("Selling Price (₹) *") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                            OutlinedTextField(
                                value = newMrp,
                                onValueChange = { newMrp = it },
                                label = { Text("MRP (₹)") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = newCost,
                                onValueChange = { newCost = it },
                                label = { Text("Cost Price (₹)") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                            OutlinedTextField(
                                value = newStock,
                                onValueChange = { newStock = it },
                                label = { Text("Stock Qty") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = newHsn,
                                onValueChange = { newHsn = it },
                                label = { Text("HSN Code") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                            OutlinedTextField(
                                value = newDeliveryCharge,
                                onValueChange = { newDeliveryCharge = it },
                                label = { Text("Delivery (₹)") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                        }

                        HorizontalDivider(color = CardBorder, modifier = Modifier.padding(vertical = 4.dp))
                        Text("Variants & Photos", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = ForestGreen)

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = newSize,
                                onValueChange = { newSize = it },
                                label = { Text("Size (e.g. M, L, Free)") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                            OutlinedTextField(
                                value = newColor,
                                onValueChange = { newColor = it },
                                label = { Text("Color") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        OutlinedTextField(
                            value = newImageUrl,
                            onValueChange = { newImageUrl = it },
                            label = { Text("Product Photo URL (https://...)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = newDescription,
                            onValueChange = { newDescription = it },
                            label = { Text("Description") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (newName.isBlank() || newSku.isBlank() || newPrice.isBlank()) {
                                Toast.makeText(context, "Please fill in Product Name, SKU, and Price.", Toast.LENGTH_SHORT).show()
                                return@Button
                            }
                            val priceVal = newPrice.toDoubleOrNull() ?: 0.0
                            val mrpVal = newMrp.toDoubleOrNull()
                            val costVal = newCost.toDoubleOrNull() ?: 0.0
                            val stockVal = newStock.toIntOrNull() ?: 0
                            val delVal = newDeliveryCharge.toDoubleOrNull()
                            val imgs = if (newImageUrl.isNotBlank()) listOf(newImageUrl.trim()) else emptyList()

                            scope.launch {
                                when (val res = repository.createAdminProduct(
                                    name = newName,
                                    sku = newSku,
                                    sellingPrice = priceVal,
                                    costPrice = costVal,
                                    mrp = mrpVal,
                                    stock = stockVal,
                                    category = newCategory.ifBlank { null },
                                    brand = newBrand.ifBlank { null },
                                    size = newSize.ifBlank { null },
                                    color = newColor.ifBlank { null },
                                    description = newDescription.ifBlank { null },
                                    hsnCode = newHsn.ifBlank { null },
                                    deliveryCharge = delVal,
                                    status = "ACTIVE",
                                    imageUrls = imgs
                                )) {
                                    is ApiResult.Success -> {
                                        Toast.makeText(context, res.data, Toast.LENGTH_SHORT).show()
                                        showAddDialog = false
                                        newName = ""; newSku = ""; newPrice = ""; newMrp = ""; newCost = ""; newStock = "0"; newCategory = ""; newBrand = ""; newSize = ""; newColor = ""; newHsn = ""; newDeliveryCharge = ""; newImageUrl = ""; newDescription = ""
                                        load()
                                    }
                                    is ApiResult.Error -> Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = ForestGreen)
                    ) { Text("Create Product") }
                },
                dismissButton = {
                    TextButton(onClick = { showAddDialog = false }) { Text("Cancel") }
                }
            )
        }

        // Adjust Stock Dialog
        if (editingProduct != null) {
            AlertDialog(
                onDismissRequest = { editingProduct = null },
                title = { Text("Adjust Stock: ${editingProduct!!.name}") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Current SKU: ${editingProduct!!.sku}", fontSize = 12.sp, color = MutedText)
                        OutlinedTextField(
                            value = stockInput,
                            onValueChange = { stockInput = it },
                            label = { Text("Available Stock Units") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val qty = stockInput.toIntOrNull() ?: 0
                            scope.launch {
                                when (val res = repository.updateAdminProductStock(editingProduct!!.id, qty)) {
                                    is ApiResult.Success -> {
                                        Toast.makeText(context, res.data, Toast.LENGTH_SHORT).show()
                                        editingProduct = null
                                        load()
                                    }
                                    is ApiResult.Error -> Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = ForestGreen)
                    ) { Text("Save Stock") }
                },
                dismissButton = {
                    TextButton(onClick = { editingProduct = null }) { Text("Cancel") }
                }
            )
        }
    }
}

@Composable
fun SuppliersTab(repository: AdminApiRepository) {
    var suppliers by remember { mutableStateOf<List<AdminSupplier>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    var showAddDialog by remember { mutableStateOf(false) }
    var companyNameInput by remember { mutableStateOf("") }
    var contactNameInput by remember { mutableStateOf("") }
    var emailInput by remember { mutableStateOf("") }
    var phoneInput by remember { mutableStateOf("") }
    var pickupAddressInput by remember { mutableStateOf("") }
    var pickupCityInput by remember { mutableStateOf("") }
    var pickupStateInput by remember { mutableStateOf("") }
    var gstNumberInput by remember { mutableStateOf("") }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    fun load() {
        isLoading = true
        scope.launch {
            when (val res = repository.fetchSuppliers()) {
                is ApiResult.Success -> { suppliers = res.data; isLoading = false }
                is ApiResult.Error -> { isLoading = false }
            }
        }
    }

    LaunchedEffect(Unit) { load() }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Registered Suppliers", fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = ForestGreen)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Button(
                    onClick = { showAddDialog = true },
                    colors = ButtonDefaults.buttonColors(containerColor = ForestGreen),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Supplier", fontSize = 12.sp)
                }
                IconButton(onClick = { load() }) { Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = ForestGreen) }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = ForestGreen) }
        } else if (suppliers.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("No suppliers registered.", color = MutedText) }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(suppliers) { item ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, CardBorder),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(item.companyName, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = ForestGreen)
                                StatusBadge(status = item.status)
                            }
                            Text("Contact: ${item.contactName} (${item.email})", fontSize = 13.sp, color = InkColor)
                            Text("Phone: ${item.phone.ifBlank { "N/A" }} • Integration: ${item.sourceType}", fontSize = 12.sp, color = MutedText)
                        }
                    }
                }
            }
        }

        // Add Supplier Dialog
        if (showAddDialog) {
            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("Add New Supplier", fontWeight = FontWeight.Bold) },
                text = {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = companyNameInput,
                            onValueChange = { companyNameInput = it },
                            label = { Text("Company Name *") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = contactNameInput,
                            onValueChange = { contactNameInput = it },
                            label = { Text("Contact Person") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = emailInput,
                                onValueChange = { emailInput = it },
                                label = { Text("Email") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                            OutlinedTextField(
                                value = phoneInput,
                                onValueChange = { phoneInput = it },
                                label = { Text("Phone") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        OutlinedTextField(
                            value = pickupAddressInput,
                            onValueChange = { pickupAddressInput = it },
                            label = { Text("Pickup Address") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = pickupCityInput,
                                onValueChange = { pickupCityInput = it },
                                label = { Text("City") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                            OutlinedTextField(
                                value = pickupStateInput,
                                onValueChange = { pickupStateInput = it },
                                label = { Text("State") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        OutlinedTextField(
                            value = gstNumberInput,
                            onValueChange = { gstNumberInput = it },
                            label = { Text("GST Number") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (companyNameInput.isBlank()) {
                                Toast.makeText(context, "Please enter Company Name.", Toast.LENGTH_SHORT).show()
                                return@Button
                            }
                            scope.launch {
                                when (val res = repository.createAdminSupplier(
                                    companyName = companyNameInput,
                                    contactName = contactNameInput.ifBlank { null },
                                    email = emailInput.ifBlank { null },
                                    phone = phoneInput.ifBlank { null },
                                    sourceType = "DIRECT",
                                    pickupAddress = pickupAddressInput.ifBlank { null },
                                    pickupCity = pickupCityInput.ifBlank { null },
                                    pickupState = pickupStateInput.ifBlank { null },
                                    gstNumber = gstNumberInput.ifBlank { null }
                                )) {
                                    is ApiResult.Success -> {
                                        Toast.makeText(context, res.data, Toast.LENGTH_SHORT).show()
                                        showAddDialog = false
                                        companyNameInput = ""; contactNameInput = ""; emailInput = ""; phoneInput = ""
                                        pickupAddressInput = ""; pickupCityInput = ""; pickupStateInput = ""; gstNumberInput = ""
                                        load()
                                    }
                                    is ApiResult.Error -> Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = ForestGreen)
                    ) { Text("Create Supplier") }
                },
                dismissButton = {
                    TextButton(onClick = { showAddDialog = false }) { Text("Cancel") }
                }
            )
        }
    }
}

@Composable
fun ReturnsTab(repository: AdminApiRepository) {
    var returnsList by remember { mutableStateOf<List<AdminReturn>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    fun loadReturns() {
        isLoading = true
        scope.launch {
            when (val res = repository.fetchReturns()) {
                is ApiResult.Success -> { returnsList = res.data; isLoading = false }
                is ApiResult.Error -> { isLoading = false }
            }
        }
    }

    LaunchedEffect(Unit) { loadReturns() }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Returns & RTO Requests", fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = ForestGreen)
            IconButton(onClick = { loadReturns() }) { Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = ForestGreen) }
        }

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = ForestGreen) }
        } else if (returnsList.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("No return requests recorded.", color = MutedText) }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(returnsList) { item ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, CardBorder),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Return ID #${item.id.takeLast(6)}", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = ForestGreen)
                                StatusBadge(status = item.status)
                            }
                            Text("Reason: ${item.reason}", fontSize = 13.sp, color = InkColor)
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Warehouse Receipt: ${if (item.supplierReceived) "Confirmed" else "Pending"}", fontSize = 12.sp, color = if (item.supplierReceived) Color(0xFF16A34A) else Color(0xFFD97706))
                                Text("Refund: ₹${item.refundAmount}", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = ForestGreen)
                            }

                            if (item.status != "COMPLETED" && item.status != "REJECTED") {
                                HorizontalDivider(color = CardBorder)
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                                    Button(
                                        onClick = {
                                            scope.launch {
                                                when (val res = repository.processAdminReturnRefund(item.id)) {
                                                    is ApiResult.Success -> {
                                                        Toast.makeText(context, res.data, Toast.LENGTH_SHORT).show()
                                                        loadReturns()
                                                    }
                                                    is ApiResult.Error -> Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
                                                }
                                            }
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = ForestGreen),
                                        shape = RoundedCornerShape(8.dp)
                                    ) {
                                        Text("Process Return Refund", fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AdminGenericSectionTab(repository: AdminApiRepository, sectionId: String, sectionTitle: String) {
    var isLoading by remember(sectionId) { mutableStateOf(true) }
    var sectionContent by remember(sectionId) { mutableStateOf<String?>(null) }
    var errorMsg by remember(sectionId) { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun loadData() {
        scope.launch {
            isLoading = true
            errorMsg = null
            when (val res = repository.fetchAdminSection(sectionId)) {
                is ApiResult.Success -> {
                    sectionContent = res.data
                    isLoading = false
                }
                is ApiResult.Error -> {
                    errorMsg = res.message
                    isLoading = false
                }
            }
        }
    }

    LaunchedEffect(sectionId) {
        loadData()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(sectionTitle, fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = ForestGreen)
            IconButton(onClick = { loadData() }) {
                Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = ForestGreen)
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = BorderStroke(1.dp, CardBorder),
            shape = RoundedCornerShape(14.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(getNavIcon(sectionId), contentDescription = null, tint = ForestGreen, modifier = Modifier.size(32.dp))
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Image(
                                painter = painterResource(id = R.drawable.zera_logo),
                                contentDescription = "Zera's World",
                                modifier = Modifier.height(28.dp),
                                contentScale = ContentScale.Fit
                            )
                            Text(" Administration", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = ForestGreen)
                        }
                        Text("Section: $sectionTitle", fontSize = 12.sp, color = MutedText)
                    }
                }
                HorizontalDivider(color = CardBorder)

                if (isLoading) {
                    Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = ForestGreen, modifier = Modifier.size(28.dp))
                    }
                } else {
                    Text(
                        text = "This view connects directly to the $sectionTitle module on zerasworld.in. Real-time updates and management controls are active and backed by the central store database.",
                        fontSize = 13.sp,
                        color = InkColor,
                        lineHeight = 18.sp
                    )
                    if (sectionContent != null && sectionContent!!.isNotBlank()) {
                        Surface(
                            color = IvoryBg,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Live Data Synced: $sectionTitle",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = ForestGreen,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

// -------------------------------------------------------------
// SUPPLIER PORTAL (MATCHING EXACT WEB CAPABILITIES)
// -------------------------------------------------------------

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupplierDashboardScreen(
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
    val scope = rememberCoroutineScope()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    var navData by remember { mutableStateOf(repository.getDefaultNavigation("SUPPLIER")) }
    var currentSection by remember { mutableStateOf("dashboard") }
    var currentSectionLabel by remember { mutableStateOf("Dashboard") }

    LaunchedEffect(Unit) {
        when (val res = repository.fetchNavigation()) {
            is ApiResult.Success -> navData = res.data
            is ApiResult.Error -> {}
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = Color.White,
                modifier = Modifier.widthIn(max = 310.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(ForestGreen, ForestDeep)
                            )
                        )
                        .padding(20.dp)
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.zera_logo_white),
                        contentDescription = "Zera's World",
                        modifier = Modifier
                            .fillMaxWidth(0.85f)
                            .height(46.dp)
                            .padding(bottom = 6.dp),
                        contentScale = ContentScale.Fit,
                        alignment = Alignment.CenterStart
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(
                            color = LuxuryGold,
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text("SUPPLIER", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color.White, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(user.supplierName ?: "Supplier Portal", color = Color.White.copy(alpha = 0.9f), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Text(user.fullName, color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                }

                HorizontalDivider(color = CardBorder)

                LazyColumn(
                    modifier = Modifier.weight(1f).padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    navData.groups.forEach { group ->
                        item {
                            Text(
                                text = group.label.uppercase(),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = MutedText,
                                letterSpacing = 1.sp,
                                modifier = Modifier.padding(start = 12.dp, top = 14.dp, bottom = 4.dp)
                            )
                        }
                        items(group.items) { item ->
                            val isSelected = currentSection == item.id
                            NavigationDrawerItem(
                                icon = {
                                    Icon(
                                        getNavIcon(item.id),
                                        contentDescription = null,
                                        tint = if (isSelected) Color.White else ForestGreen
                                    )
                                },
                                label = {
                                    Text(
                                        item.label,
                                        fontSize = 13.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                                    )
                                },
                                selected = isSelected,
                                onClick = {
                                    currentSection = item.id
                                    currentSectionLabel = item.label
                                    scope.launch { drawerState.close() }
                                },
                                modifier = Modifier.padding(vertical = 1.dp),
                                shape = RoundedCornerShape(10.dp),
                                colors = NavigationDrawerItemDefaults.colors(
                                    selectedContainerColor = ForestGreen,
                                    selectedTextColor = Color.White,
                                    unselectedContainerColor = Color.Transparent,
                                    unselectedTextColor = ForestGreen
                                )
                            )
                        }
                    }
                }

                HorizontalDivider(color = CardBorder)
                NavigationDrawerItem(
                    icon = { Icon(Icons.Default.Logout, contentDescription = null, tint = Color(0xFFDC2626)) },
                    label = { Text("Sign Out", color = Color(0xFFDC2626), fontSize = 14.sp, fontWeight = FontWeight.Bold) },
                    selected = false,
                    onClick = onLogout,
                    modifier = Modifier.padding(10.dp)
                )
            }
        }
    ) {
        Column(modifier = Modifier.fillMaxSize().background(IvoryBg)) {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = { scope.launch { drawerState.open() } }) {
                        Icon(Icons.Default.Menu, contentDescription = "Menu", tint = ForestGreen)
                    }
                },
                title = {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Image(
                                painter = painterResource(id = R.drawable.zera_logo),
                                contentDescription = "Zera's World",
                                modifier = Modifier.height(26.dp),
                                contentScale = ContentScale.Fit
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("· $currentSectionLabel", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MutedText, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        Text("${user.fullName} • ${user.supplierName ?: "Supplier"}", fontSize = 11.sp, color = MutedText)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.White,
                    titleContentColor = ForestGreen,
                    navigationIconContentColor = ForestGreen,
                    actionIconContentColor = ForestGreen
                ),
                actions = {
                    if (currentSection != "notifications") {
                        IconButton(onClick = { currentSection = "notifications"; currentSectionLabel = "Notifications" }) {
                            Icon(Icons.Default.Notifications, contentDescription = "Alerts")
                        }
                    }
                    IconButton(onClick = onLogout) { Icon(Icons.Default.Logout, contentDescription = "Sign Out") }
                }
            )

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !hasNotifPermission) {
                Surface(color = Color(0xFFFEF3C7), modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Android 13+ requires notification permission for FCM alerts.", fontSize = 12.sp, color = Color(0xFF92400E))
                        Button(onClick = onRequestPermission, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD97706))) {
                            Text("Allow", fontSize = 11.sp)
                        }
                    }
                }
            }

            Box(modifier = Modifier.weight(1f)) {
                when (currentSection) {
                    "dashboard" -> SupplierDashboardTab(
                        repository = repository,
                        onNavigate = { id, label ->
                            currentSection = id
                            currentSectionLabel = label
                        }
                    )
                    "orders" -> SupplierOrdersTab(repository = repository)
                    "products" -> SupplierProductsTab(repository = repository)
                    "shipments" -> SupplierShipmentsTab(repository = repository)
                    "returns" -> SupplierReturnsTab(repository = repository)
                    "payments", "reports" -> SupplierPaymentsTab(repository = repository, section = currentSection, title = currentSectionLabel)
                    "local-customers" -> SupplierLocalCustomersTab(repository = repository)
                    "support" -> SupplierSupportTab(repository = repository)
                    "profile", "pickup-address", "company-profile" -> SupplierProfileTab(repository = repository, section = currentSection, title = currentSectionLabel, user = user)
                    "notifications" -> AlertsTab(sessionManager = sessionManager, repository = repository, fcmToken = fcmToken, isTokenRegistered = isTokenRegistered, onTokenRegisterClick = onTokenRegisterClick)
                    else -> SupplierSectionDetailTab(repository = repository, sectionId = currentSection, sectionTitle = currentSectionLabel)
                }
            }
        }
    }
}

@Composable
fun SupplierDashboardTab(
    repository: AdminApiRepository,
    onNavigate: (String, String) -> Unit
) {
    var orderLines by remember { mutableIntStateOf(0) }
    var awaitingCount by remember { mutableIntStateOf(0) }
    var shippedCount by remember { mutableIntStateOf(0) }
    var deliveredCount by remember { mutableIntStateOf(0) }
    var isLoading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    fun load() {
        isLoading = true
        scope.launch {
            when (val ordersRes = repository.fetchOrders()) {
                is ApiResult.Success -> {
                    orderLines = ordersRes.data.size
                    awaitingCount = ordersRes.data.count { it.status == "PENDING" || it.status == "ACCEPTED" }
                    shippedCount = ordersRes.data.count { it.status == "SHIPPED" }
                    deliveredCount = ordersRes.data.count { it.status == "DELIVERED" }
                    isLoading = false
                }
                is ApiResult.Error -> isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { load() }

    if (isLoading) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = ForestGreen) }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Supplier Store Overview", fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = ForestGreen)
                    IconButton(onClick = { load() }) { Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = ForestGreen) }
                }
            }
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    KpiCard("Assigned Order Lines", orderLines.toString(), Icons.Default.ShoppingCart, ForestGreen, Modifier.weight(1f), "Most recent lines")
                    KpiCard("Awaiting Fulfilment", awaitingCount.toString(), Icons.Default.Pending, LuxuryGold, Modifier.weight(1f), "Needs accept/packing")
                }
            }
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    KpiCard("Shipped Lines", shippedCount.toString(), Icons.Default.LocalShipping, Color(0xFF2563EB), Modifier.weight(1f), "In transit with courier")
                    KpiCard("Delivered Lines", deliveredCount.toString(), Icons.Default.CheckCircle, Color(0xFF16A34A), Modifier.weight(1f), "Fulfilment completed")
                }
            }
            item {
                AdminNoticeCard("Only orders assigned to your supplier account are visible. Fulfilment actions require a verified prepaid order or an eligible cash-on-delivery order. Submitted products remain drafts until the store publishes them.")
            }
            item {
                Text("Fulfilment Operations", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = ForestGreen, modifier = Modifier.padding(top = 8.dp))
            }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { onNavigate("orders", "Orders") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, ForestGreen)
                    ) {
                        Icon(Icons.Default.ShoppingCart, contentDescription = null, tint = ForestGreen, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Process Assigned Orders & Enter AWB", color = ForestGreen, fontWeight = FontWeight.Bold)
                    }
                    OutlinedButton(
                        onClick = { onNavigate("products", "Products & Inventory") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, ForestGreen)
                    ) {
                        Icon(Icons.Default.Inventory, contentDescription = null, tint = ForestGreen, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Manage Catalog & Adjust Supplier Stock", color = ForestGreen, fontWeight = FontWeight.Bold)
                    }
                    OutlinedButton(
                        onClick = { onNavigate("shipments", "Shipments & Tracking") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, ForestGreen)
                    ) {
                        Icon(Icons.Default.LocalShipping, contentDescription = null, tint = ForestGreen, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Shipments & Live Tracking Events", color = ForestGreen, fontWeight = FontWeight.Bold)
                    }
                    OutlinedButton(
                        onClick = { onNavigate("notifications", "Notifications") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, ForestGreen)
                    ) {
                        Icon(Icons.Default.Notifications, contentDescription = null, tint = ForestGreen, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("FCM Notification Alert Center", color = ForestGreen, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun SupplierOrdersTab(repository: AdminApiRepository) {
    val context = LocalContext.current
    var ordersList by remember { mutableStateOf<List<AdminOrder>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var awbInputMap by remember { mutableStateOf(mapOf<String, String>()) }
    var courierMap by remember { mutableStateOf(mapOf<String, String>()) }
    val scope = rememberCoroutineScope()

    fun load() {
        isLoading = true
        scope.launch {
            when (val res = repository.fetchOrders()) {
                is ApiResult.Success -> { ordersList = res.data; isLoading = false }
                is ApiResult.Error -> { isLoading = false }
            }
        }
    }

    LaunchedEffect(Unit) { load() }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Assigned Supplier Orders", fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = ForestGreen)
            IconButton(onClick = { load() }) { Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = ForestGreen) }
        }

        AdminNoticeCard("Confirmed COD orders can be processed immediately. Collect the COD total per order through your courier. Accept, process, and pack each assigned item before entering its AWB.")

        Spacer(modifier = Modifier.height(10.dp))

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = ForestGreen) }
        } else if (ordersList.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("No assigned order lines.", color = MutedText) }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(ordersList) { order ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, CardBorder),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text("Order #${order.marketplaceOrderId}", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = ForestGreen)
                                StatusBadge(status = order.status)
                            }

                            Text("Customer: ${order.customerName}", fontSize = 13.sp, color = InkColor, fontWeight = FontWeight.Medium)
                            Text("Date: ${order.createdAt.take(10)}", fontSize = 11.sp, color = MutedText)

                            order.items.forEach { item ->
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(IvoryBg, RoundedCornerShape(8.dp))
                                        .padding(12.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text("SKU: ${item.sku ?: "SKU-N/A"} • Qty: ${item.quantity}", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = ForestGreen)
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("Fulfillment: ${item.fulfillmentStatus}", fontSize = 12.sp, color = MutedText)
                                        Text("Supply Total: ₹${item.unitPrice * item.quantity}", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = ForestGreen)
                                    }

                                    // Action buttons exactly matching the website state machine
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
                                        if (item.fulfillmentStatus == "PENDING") {
                                            Button(
                                                onClick = {
                                                    scope.launch {
                                                        when (val res = repository.updateSupplierOrderFulfillment(item.id, "ACCEPTED")) {
                                                            is ApiResult.Success -> { Toast.makeText(context, res.data, Toast.LENGTH_SHORT).show(); load() }
                                                            is ApiResult.Error -> Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
                                                        }
                                                    }
                                                },
                                                colors = ButtonDefaults.buttonColors(containerColor = ForestGreen),
                                                shape = RoundedCornerShape(6.dp),
                                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                            ) { Text("Accept", fontSize = 12.sp) }

                                            OutlinedButton(
                                                onClick = {
                                                    scope.launch {
                                                        when (val res = repository.updateSupplierOrderFulfillment(item.id, "REJECTED")) {
                                                            is ApiResult.Success -> { Toast.makeText(context, res.data, Toast.LENGTH_SHORT).show(); load() }
                                                            is ApiResult.Error -> Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
                                                        }
                                                    }
                                                },
                                                border = BorderStroke(1.dp, Color(0xFFDC2626)),
                                                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFDC2626)),
                                                shape = RoundedCornerShape(6.dp),
                                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                            ) { Text("Reject", fontSize = 12.sp) }
                                        }

                                        if (item.fulfillmentStatus == "ACCEPTED") {
                                            Button(
                                                onClick = {
                                                    scope.launch {
                                                        when (val res = repository.updateSupplierOrderFulfillment(item.id, "PROCESSING")) {
                                                            is ApiResult.Success -> { Toast.makeText(context, res.data, Toast.LENGTH_SHORT).show(); load() }
                                                            is ApiResult.Error -> Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
                                                        }
                                                    }
                                                },
                                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1D4ED8)),
                                                shape = RoundedCornerShape(6.dp),
                                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                            ) { Text("Mark Processing", fontSize = 12.sp) }
                                        }

                                        if (item.fulfillmentStatus == "PROCESSING") {
                                            Button(
                                                onClick = {
                                                    scope.launch {
                                                        when (val res = repository.updateSupplierOrderFulfillment(item.id, "PACKED")) {
                                                            is ApiResult.Success -> { Toast.makeText(context, res.data, Toast.LENGTH_SHORT).show(); load() }
                                                            is ApiResult.Error -> Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
                                                        }
                                                    }
                                                },
                                                colors = ButtonDefaults.buttonColors(containerColor = ForestGreen),
                                                shape = RoundedCornerShape(6.dp),
                                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                            ) { Text("Mark Packed", fontSize = 12.sp) }
                                        }
                                    }

                                    // Dispatch & AWB input when PACKED
                                    if (item.fulfillmentStatus == "PACKED") {
                                        val selectedCourier = courierMap[item.id] ?: "Delhivery"
                                        val awbVal = awbInputMap[item.id] ?: ""

                                        Column(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .background(Color.White, RoundedCornerShape(8.dp))
                                                .padding(10.dp),
                                            verticalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            Text("Enter Dispatch AWB", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = ForestGreen)

                                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                FilterChip(
                                                    selected = selectedCourier == "Delhivery",
                                                    onClick = { courierMap = courierMap.toMutableMap().apply { put(item.id, "Delhivery") } },
                                                    label = { Text("Delhivery", fontSize = 11.sp) }
                                                )
                                                FilterChip(
                                                    selected = selectedCourier == "Shiprocket",
                                                    onClick = { courierMap = courierMap.toMutableMap().apply { put(item.id, "Shiprocket") } },
                                                    label = { Text("Shiprocket", fontSize = 11.sp) }
                                                )
                                            }

                                            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                                OutlinedTextField(
                                                    value = awbVal,
                                                    onValueChange = { awbInputMap = awbInputMap.toMutableMap().apply { put(item.id, it) } },
                                                    label = { Text("$selectedCourier AWB") },
                                                    modifier = Modifier.weight(1f),
                                                    singleLine = true,
                                                    shape = RoundedCornerShape(8.dp)
                                                )
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Button(
                                                    onClick = {
                                                        if (awbVal.isBlank()) {
                                                            Toast.makeText(context, "Please enter an AWB number.", Toast.LENGTH_SHORT).show()
                                                            return@Button
                                                        }
                                                        scope.launch {
                                                            when (val res = repository.submitSupplierShipmentAWB(item.id, awbVal, selectedCourier)) {
                                                                is ApiResult.Success -> {
                                                                    Toast.makeText(context, res.data, Toast.LENGTH_SHORT).show()
                                                                    load()
                                                                }
                                                                is ApiResult.Error -> Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
                                                            }
                                                        }
                                                    },
                                                    colors = ButtonDefaults.buttonColors(containerColor = ForestGreen),
                                                    shape = RoundedCornerShape(8.dp)
                                                ) { Text("Dispatch", fontSize = 12.sp) }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SupplierProductsTab(repository: AdminApiRepository) {
    var products by remember { mutableStateOf<List<AdminProduct>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var showAddDialog by remember { mutableStateOf(false) }
    var editingProduct by remember { mutableStateOf<AdminProduct?>(null) }

    // Form inputs for submission
    var nameInput by remember { mutableStateOf("") }
    var skuInput by remember { mutableStateOf("") }
    var descInput by remember { mutableStateOf("") }
    var hsnInput by remember { mutableStateOf("") }
    var priceInput by remember { mutableStateOf("") }
    var stockInput by remember { mutableStateOf("") }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    fun fallbackProducts() {
        scope.launch {
            when (val res = repository.fetchProducts()) {
                is ApiResult.Success -> { products = res.data; isLoading = false }
                is ApiResult.Error -> { isLoading = false }
            }
        }
    }

    fun load() {
        isLoading = true
        scope.launch {
            when (val res = repository.fetchSupplierSection("products")) {
                is ApiResult.Success -> {
                    try {
                        val json = JSONObject(res.data)
                        val arr = json.optJSONArray("data") ?: JSONArray()
                        val list = mutableListOf<AdminProduct>()
                        for (i in 0 until arr.length()) {
                            val o = arr.getJSONObject(i)
                            val invArr = o.optJSONArray("inventory")
                            val qty = if (invArr != null && invArr.length() > 0) invArr.getJSONObject(0).optInt("availableQty", 0) else 0
                            list.add(
                                AdminProduct(
                                    id = o.optString("id"),
                                    name = o.optString("name", "Product"),
                                    sku = o.optString("sku", "N/A"),
                                    category = o.optString("hsnCode", "General"),
                                    status = o.optString("status", "ACTIVE"),
                                    sellingPrice = o.optDouble("costPrice", 0.0),
                                    costPrice = o.optDouble("costPrice", 0.0),
                                    availableQty = qty,
                                    supplierName = ""
                                )
                            )
                        }
                        products = list
                        isLoading = false
                    } catch (_: Exception) {
                        fallbackProducts()
                    }
                }
                is ApiResult.Error -> fallbackProducts()
            }
        }
    }

    LaunchedEffect(Unit) { load() }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Products & Inventory", fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = ForestGreen)
            Row {
                IconButton(onClick = { showAddDialog = true }) { Icon(Icons.Default.AddCircle, contentDescription = "Add Product", tint = ForestGreen) }
                IconButton(onClick = { load() }) { Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = ForestGreen) }
            }
        }

        AdminNoticeCard("Updating supplier price also updates the product cost price. HSN changes appear in the product details. Stock units include reserved units. Submitted products remain drafts until store admin publishes them.")

        Spacer(modifier = Modifier.height(10.dp))

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = ForestGreen) }
        } else if (products.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("No products found.", color = MutedText) }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(products) { item ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, CardBorder),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(item.name, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = ForestGreen)
                                StatusBadge(status = item.status)
                            }
                            Text("SKU: ${item.sku} • HSN: ${item.category}", fontSize = 12.sp, color = MutedText)
                            Row(modifier = Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Available: ${item.availableQty} units", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = InkColor)
                                Text("Price: ₹${item.sellingPrice}", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = ForestGreen)
                            }

                            Row(modifier = Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.End) {
                                OutlinedButton(
                                    onClick = {
                                        editingProduct = item
                                        stockInput = item.availableQty.toString()
                                        priceInput = item.sellingPrice.toString()
                                        hsnInput = item.category
                                    },
                                    shape = RoundedCornerShape(8.dp),
                                    border = BorderStroke(1.dp, ForestGreen),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                ) {
                                    Icon(Icons.Default.Edit, contentDescription = null, tint = ForestGreen, modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Update Stock & Price", fontSize = 12.sp, color = ForestGreen)
                                }
                            }
                        }
                    }
                }
            }
        }

        // Add Product Dialog matching website SupplierPortalForm action="PRODUCT"
        if (showAddDialog) {
            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("Submit Product for Approval", fontWeight = FontWeight.Bold, color = ForestGreen) },
                text = {
                    Column(
                        modifier = Modifier.verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(value = nameInput, onValueChange = { nameInput = it }, label = { Text("Product Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = skuInput, onValueChange = { skuInput = it }, label = { Text("Unique SKU") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = descInput, onValueChange = { descInput = it }, label = { Text("Description") }, maxLines = 3, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = hsnInput, onValueChange = { hsnInput = it }, label = { Text("HSN Code (optional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = priceInput, onValueChange = { priceInput = it }, label = { Text("Supply Price (INR)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = stockInput, onValueChange = { stockInput = it }, label = { Text("Stock Units") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.fillMaxWidth())
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val price = priceInput.toDoubleOrNull() ?: 0.0
                            val stock = stockInput.toIntOrNull() ?: 0
                            if (nameInput.isBlank() || skuInput.isBlank()) {
                                Toast.makeText(context, "Name and SKU are required.", Toast.LENGTH_SHORT).show()
                                return@Button
                            }
                            scope.launch {
                                when (val res = repository.submitSupplierProduct(nameInput, skuInput, descInput, hsnInput, price, stock)) {
                                    is ApiResult.Success -> {
                                        Toast.makeText(context, res.data, Toast.LENGTH_SHORT).show()
                                        showAddDialog = false
                                        load()
                                    }
                                    is ApiResult.Error -> Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = ForestGreen)
                    ) { Text("Submit Draft") }
                },
                dismissButton = {
                    TextButton(onClick = { showAddDialog = false }) { Text("Cancel") }
                }
            )
        }

        // Inline Update Stock & Price Dialog matching website SupplierPortalForm action="STOCK"
        if (editingProduct != null) {
            AlertDialog(
                onDismissRequest = { editingProduct = null },
                title = { Text("Update Stock & Price: ${editingProduct!!.name}", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = ForestGreen) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("SKU: ${editingProduct!!.sku}", fontSize = 12.sp, color = MutedText)
                        OutlinedTextField(value = stockInput, onValueChange = { stockInput = it }, label = { Text("Stock Units") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = priceInput, onValueChange = { priceInput = it }, label = { Text("Supplier Price (INR)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = hsnInput, onValueChange = { hsnInput = it }, label = { Text("HSN Code") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val stock = stockInput.toIntOrNull() ?: 0
                            val price = priceInput.toDoubleOrNull() ?: 0.0
                            scope.launch {
                                when (val res = repository.updateSupplierProductStock(editingProduct!!.id, stock, price, hsnInput)) {
                                    is ApiResult.Success -> {
                                        Toast.makeText(context, res.data, Toast.LENGTH_SHORT).show()
                                        editingProduct = null
                                        load()
                                    }
                                    is ApiResult.Error -> Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = ForestGreen)
                    ) { Text("Save Changes") }
                },
                dismissButton = {
                    TextButton(onClick = { editingProduct = null }) { Text("Cancel") }
                }
            )
        }
    }
}

@Composable
fun SupplierShipmentsTab(repository: AdminApiRepository) {
    var shipments by remember { mutableStateOf<List<SupplierShipmentItem>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    fun load() {
        isLoading = true
        scope.launch {
            when (val res = repository.fetchSupplierSection("shipments")) {
                is ApiResult.Success -> {
                    try {
                        val json = JSONObject(res.data)
                        val arr = json.optJSONArray("data") ?: JSONArray()
                        val list = mutableListOf<SupplierShipmentItem>()
                        for (i in 0 until arr.length()) {
                            val o = arr.getJSONObject(i)
                            val orderObj = o.optJSONObject("customerOrder")
                            val events = o.optJSONArray("trackingEvents")
                            val lastEventDesc = if (events != null && events.length() > 0) events.getJSONObject(0).optString("description", "") else ""
                            list.add(
                                SupplierShipmentItem(
                                    id = o.optString("id"),
                                    trackingNumber = o.optString("trackingNumber", "AWB Pending"),
                                    courierName = o.optString("courierName", "Delhivery"),
                                    status = o.optString("status", "IN_TRANSIT"),
                                    orderId = orderObj?.optString("marketplaceOrderId") ?: "N/A",
                                    latestEvent = lastEventDesc
                                )
                            )
                        }
                        shipments = list
                    } catch (_: Exception) {}
                    isLoading = false
                }
                is ApiResult.Error -> isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { load() }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Shipments & Tracking", fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = ForestGreen)
            IconButton(onClick = { load() }) { Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = ForestGreen) }
        }

        AdminNoticeCard("Choose Shiprocket or Delhivery and enter an AWB already booked with that provider. This records dispatch and activates live courier tracking for your store orders.")

        Spacer(modifier = Modifier.height(10.dp))

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = ForestGreen) }
        } else if (shipments.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("No supplier shipments recorded.", color = MutedText) }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(shipments) { s ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, CardBorder),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("AWB: ${s.trackingNumber}", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = ForestGreen)
                                StatusBadge(status = s.status)
                            }
                            Text("Courier: ${s.courierName} • Order #${s.orderId}", fontSize = 12.sp, color = InkColor)
                            if (s.latestEvent.isNotBlank()) {
                                Surface(
                                    color = IvoryBg,
                                    shape = RoundedCornerShape(6.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text("Latest: ${s.latestEvent}", fontSize = 11.sp, color = MutedText, modifier = Modifier.padding(8.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SupplierReturnsTab(repository: AdminApiRepository) {
    var returnsList by remember { mutableStateOf<List<AdminReturn>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    fun fallbackReturns() {
        scope.launch {
            when (val res = repository.fetchReturns()) {
                is ApiResult.Success -> { returnsList = res.data; isLoading = false }
                is ApiResult.Error -> { isLoading = false }
            }
        }
    }

    fun load() {
        isLoading = true
        scope.launch {
            when (val res = repository.fetchSupplierSection("returns")) {
                is ApiResult.Success -> {
                    try {
                        val json = JSONObject(res.data)
                        val arr = json.optJSONArray("data") ?: JSONArray()
                        val list = mutableListOf<AdminReturn>()
                        for (i in 0 until arr.length()) {
                            val o = arr.getJSONObject(i)
                            list.add(
                                AdminReturn(
                                    id = o.optString("id"),
                                    customerOrderId = "",
                                    reason = o.optString("reason", "Customer return"),
                                    status = o.optString("status", "OPEN"),
                                    refundAmount = 0.0,
                                    supplierReceived = !o.isNull("supplierReceivedAt"),
                                    createdAt = ""
                                )
                            )
                        }
                        returnsList = list
                        isLoading = false
                    } catch (_: Exception) {
                        fallbackReturns()
                    }
                }
                is ApiResult.Error -> fallbackReturns()
            }
        }
    }

    LaunchedEffect(Unit) { load() }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Returns & RTO", fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = ForestGreen)
            IconButton(onClick = { load() }) { Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = ForestGreen) }
        }

        AdminNoticeCard("Review customer return requests. When an approved return physically reaches your pickup or return location, confirm receipt below.")

        Spacer(modifier = Modifier.height(10.dp))

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = ForestGreen) }
        } else if (returnsList.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("No assigned returns or RTO shipments.", color = MutedText) }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(returnsList) { r ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, CardBorder),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Return ID #${r.id.takeLast(6)}", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = ForestGreen)
                                StatusBadge(status = r.status)
                            }
                            Text("Reason: ${r.reason}", fontSize = 13.sp, color = InkColor)
                            Text("Warehouse Receipt: ${if (r.supplierReceived) "Confirmed" else "Pending"}", fontSize = 12.sp, color = if (r.supplierReceived) Color(0xFF16A34A) else Color(0xFFD97706))

                            // Action matching website action="RETURN_RECEIVED"
                            if (!r.supplierReceived && r.status == "APPROVED") {
                                HorizontalDivider(color = CardBorder)
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                                    Button(
                                        onClick = {
                                            scope.launch {
                                                when (val res = repository.confirmSupplierReturnReceived(r.id)) {
                                                    is ApiResult.Success -> {
                                                        Toast.makeText(context, res.data, Toast.LENGTH_SHORT).show()
                                                        load()
                                                    }
                                                    is ApiResult.Error -> Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
                                                }
                                            }
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = ForestGreen),
                                        shape = RoundedCornerShape(8.dp)
                                    ) {
                                        Text("Confirm Return Received", fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SupplierPaymentsTab(repository: AdminApiRepository, section: String, title: String) {
    var settlements by remember { mutableStateOf<List<SupplierSettlementItem>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    fun load() {
        isLoading = true
        scope.launch {
            when (val res = repository.fetchSupplierSection(section)) {
                is ApiResult.Success -> {
                    try {
                        val json = JSONObject(res.data)
                        val arr = json.optJSONArray("data") ?: JSONArray()
                        val list = mutableListOf<SupplierSettlementItem>()
                        for (i in 0 until arr.length()) {
                            val o = arr.getJSONObject(i)
                            list.add(
                                SupplierSettlementItem(
                                    id = o.optString("id"),
                                    amount = o.optDouble("amount", 0.0),
                                    paidAt = o.optString("paidAt", "Pending"),
                                    reference = o.optString("reference", "N/A"),
                                    notes = o.optString("notes", "")
                                )
                            )
                        }
                        settlements = list
                    } catch (_: Exception) {}
                    isLoading = false
                }
                is ApiResult.Error -> isLoading = false
            }
        }
    }

    LaunchedEffect(section) { load() }

    val totalSettled = settlements.sumOf { it.amount }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(title, fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = ForestGreen)
            IconButton(onClick = { load() }) { Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = ForestGreen) }
        }

        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            KpiCard("Recorded Settlements", "₹${"%.2f".format(totalSettled)}", Icons.Default.AccountBalance, ForestGreen, Modifier.weight(1f), "Total payout history")
            KpiCard("Entries Count", settlements.size.toString(), Icons.Default.Receipt, LuxuryGold, Modifier.weight(1f), "Settled transactions")
        }

        AdminNoticeCard("These records reflect processed supplier settlements. Bank transfers are handled through verified finance reconciliation.")

        Spacer(modifier = Modifier.height(10.dp))

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = ForestGreen) }
        } else if (settlements.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("No supplier settlements recorded.", color = MutedText) }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(settlements) { s ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, CardBorder),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Payout: ₹${s.amount}", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = ForestGreen)
                                Text(s.paidAt.take(10), fontSize = 12.sp, color = MutedText)
                            }
                            Text("Reference: ${s.reference}", fontSize = 12.sp, color = InkColor)
                            if (s.notes.isNotBlank()) Text("Notes: ${s.notes}", fontSize = 11.sp, color = MutedText)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SupplierLocalCustomersTab(repository: AdminApiRepository) {
    var customers by remember { mutableStateOf<List<SupplierLocalCustomerItem>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    fun load() {
        isLoading = true
        scope.launch {
            when (val res = repository.fetchSupplierSection("local-customers")) {
                is ApiResult.Success -> {
                    try {
                        val json = JSONObject(res.data)
                        val arr = json.optJSONArray("data") ?: JSONArray()
                        val list = mutableListOf<SupplierLocalCustomerItem>()
                        for (i in 0 until arr.length()) {
                            val o = arr.getJSONObject(i)
                            list.add(
                                SupplierLocalCustomerItem(
                                    id = o.optString("id"),
                                    name = o.optString("name", "Customer"),
                                    phone = o.optString("phone", "N/A"),
                                    email = o.optString("email", ""),
                                    address = o.optString("address", "")
                                )
                            )
                        }
                        customers = list
                    } catch (_: Exception) {}
                    isLoading = false
                }
                is ApiResult.Error -> isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { load() }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Local Customers Directory", fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = ForestGreen)
            IconButton(onClick = { load() }) { Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = ForestGreen) }
        }

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = ForestGreen) }
        } else if (customers.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("No local customers found.", color = MutedText) }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(customers) { c ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, CardBorder),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(c.name, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = ForestGreen)
                            Text("Phone: ${c.phone}", fontSize = 13.sp, color = InkColor)
                            if (c.email.isNotBlank()) Text("Email: ${c.email}", fontSize = 12.sp, color = MutedText)
                            if (c.address.isNotBlank()) Text("Address: ${c.address}", fontSize = 12.sp, color = MutedText)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SupplierSupportTab(repository: AdminApiRepository) {
    var tickets by remember { mutableStateOf<List<SupplierSupportItem>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    fun load() {
        isLoading = true
        scope.launch {
            when (val res = repository.fetchSupplierSection("support")) {
                is ApiResult.Success -> {
                    try {
                        val json = JSONObject(res.data)
                        val arr = json.optJSONArray("data") ?: JSONArray()
                        val list = mutableListOf<SupplierSupportItem>()
                        for (i in 0 until arr.length()) {
                            val o = arr.getJSONObject(i)
                            list.add(
                                SupplierSupportItem(
                                    id = o.optString("id"),
                                    subject = o.optString("subject", "Inquiry"),
                                    message = o.optString("message", ""),
                                    status = o.optString("status", "OPEN"),
                                    reply = o.optString("reply", "")
                                )
                            )
                        }
                        tickets = list
                    } catch (_: Exception) {}
                    isLoading = false
                }
                is ApiResult.Error -> isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { load() }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Supplier Support Desk", fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = ForestGreen)
            IconButton(onClick = { load() }) { Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = ForestGreen) }
        }

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = ForestGreen) }
        } else if (tickets.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("No support tickets recorded.", color = MutedText) }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(tickets) { t ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, CardBorder),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(t.subject, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = ForestGreen)
                                StatusBadge(status = t.status)
                            }
                            Text("Inquiry: ${t.message}", fontSize = 13.sp, color = InkColor)
                            if (t.reply.isNotBlank()) {
                                Surface(
                                    color = IvoryBg,
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text("Store Admin Reply: ${t.reply}", fontSize = 12.sp, color = ForestGreen, fontWeight = FontWeight.Medium, modifier = Modifier.padding(10.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SupplierProfileTab(repository: AdminApiRepository, section: String, title: String, user: UserSession) {
    var rawData by remember { mutableStateOf<JSONObject?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var isEditing by remember { mutableStateOf(false) }

    // Editable fields matching SupplierPortalForm action="PROFILE"
    var contactName by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var pickupAddress by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var state by remember { mutableStateOf("") }
    var pincode by remember { mutableStateOf("") }
    var gstNumber by remember { mutableStateOf("") }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    fun load() {
        isLoading = true
        scope.launch {
            when (val res = repository.fetchSupplierSection(section)) {
                is ApiResult.Success -> {
                    try {
                        val json = JSONObject(res.data)
                        val data = json.optJSONObject("data") ?: json
                        rawData = data
                        contactName = data.optString("contactName", user.fullName)
                        phone = data.optString("phone", data.optString("companyPhone", ""))
                        pickupAddress = data.optString("pickupAddress", "")
                        city = data.optString("pickupCity", "")
                        state = data.optString("pickupState", "")
                        pincode = data.optString("pickupPincode", "")
                        gstNumber = data.optString("gstNumber", "")
                    } catch (_: Exception) {}
                    isLoading = false
                }
                is ApiResult.Error -> isLoading = false
            }
        }
    }

    LaunchedEffect(section) { load() }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(title, fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = ForestGreen)
            Row {
                IconButton(onClick = { isEditing = !isEditing }) { Icon(Icons.Default.Edit, contentDescription = "Edit", tint = ForestGreen) }
                IconButton(onClick = { load() }) { Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = ForestGreen) }
            }
        }

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = ForestGreen) }
        } else {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, CardBorder),
                shape = RoundedCornerShape(14.dp)
            ) {
                Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Verified Supplier Information", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = ForestGreen)
                    HorizontalDivider(color = CardBorder)

                    if (!isEditing) {
                        Text("Company: ${rawData?.optString("companyName") ?: user.supplierName ?: "Zera's World Supplier"}", fontSize = 14.sp, color = InkColor, fontWeight = FontWeight.SemiBold)
                        Text("Contact Person: ${contactName.ifBlank { user.fullName }}", fontSize = 14.sp, color = InkColor)
                        Text("Contact Phone: ${phone.ifBlank { "Not provided" }}", fontSize = 14.sp, color = InkColor)

                        if (gstNumber.isNotBlank()) {
                            Text("GST Number: $gstNumber", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = ForestGreen)
                        }

                        if (pickupAddress.isNotBlank()) {
                            Text("Pickup Address: $pickupAddress, $city, $state - $pincode", fontSize = 13.sp, color = MutedText)
                        }

                        if (rawData?.has("companyRegistrationNumber") == true && !rawData!!.optString("companyRegistrationNumber").isNullOrBlank()) {
                            Text("Registration: ${rawData!!.optString("companyRegistrationNumber")}", fontSize = 13.sp, color = MutedText)
                        }

                        Button(
                            onClick = { isEditing = true },
                            colors = ButtonDefaults.buttonColors(containerColor = ForestGreen),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.padding(top = 8.dp)
                        ) {
                            Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Edit Supplier Details")
                        }
                    } else {
                        // Editable fields matching SupplierPortalForm action="PROFILE"
                        OutlinedTextField(value = contactName, onValueChange = { contactName = it }, label = { Text("Contact Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Contact Phone") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = pickupAddress, onValueChange = { pickupAddress = it }, label = { Text("Pickup Address") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(value = city, onValueChange = { city = it }, label = { Text("City") }, singleLine = true, modifier = Modifier.weight(1f))
                            OutlinedTextField(value = state, onValueChange = { state = it }, label = { Text("State") }, singleLine = true, modifier = Modifier.weight(1f))
                        }
                        OutlinedTextField(value = pincode, onValueChange = { pincode = it }, label = { Text("Pincode") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = gstNumber, onValueChange = { gstNumber = it }, label = { Text("GST Number") }, singleLine = true, modifier = Modifier.fillMaxWidth())

                        Row(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Button(
                                onClick = {
                                    scope.launch {
                                        val params = mapOf(
                                            "contactName" to contactName,
                                            "phone" to phone,
                                            "pickupAddress" to pickupAddress,
                                            "pickupCity" to city,
                                            "pickupState" to state,
                                            "pickupPincode" to pincode,
                                            "gstNumber" to gstNumber
                                        )
                                        when (val res = repository.saveSupplierProfile(params)) {
                                            is ApiResult.Success -> {
                                                Toast.makeText(context, res.data, Toast.LENGTH_SHORT).show()
                                                isEditing = false
                                                load()
                                            }
                                            is ApiResult.Error -> Toast.makeText(context, res.message, Toast.LENGTH_LONG).show()
                                        }
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = ForestGreen),
                                modifier = Modifier.weight(1f)
                            ) { Text("Save Changes") }

                            OutlinedButton(
                                onClick = { isEditing = false },
                                modifier = Modifier.weight(1f)
                            ) { Text("Cancel") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SupplierSectionDetailTab(repository: AdminApiRepository, sectionId: String, sectionTitle: String) {
    var isLoading by remember(sectionId) { mutableStateOf(true) }
    var sectionContent by remember(sectionId) { mutableStateOf<String?>(null) }
    var errorMsg by remember(sectionId) { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun loadData() {
        scope.launch {
            isLoading = true
            errorMsg = null
            when (val res = repository.fetchSupplierSection(sectionId)) {
                is ApiResult.Success -> {
                    sectionContent = res.data
                    isLoading = false
                }
                is ApiResult.Error -> {
                    errorMsg = res.message
                    isLoading = false
                }
            }
        }
    }

    LaunchedEffect(sectionId) {
        loadData()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(sectionTitle, fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = ForestGreen)
            IconButton(onClick = { loadData() }) {
                Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = ForestGreen)
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            border = BorderStroke(1.dp, CardBorder),
            shape = RoundedCornerShape(14.dp)
        ) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(getNavIcon(sectionId), contentDescription = null, tint = ForestGreen, modifier = Modifier.size(32.dp))
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Image(
                                painter = painterResource(id = R.drawable.zera_logo),
                                contentDescription = "Zera's World",
                                modifier = Modifier.height(28.dp),
                                contentScale = ContentScale.Fit
                            )
                            Text(" Supplier Portal", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = ForestGreen)
                        }
                        Text("Section: $sectionTitle", fontSize = 12.sp, color = MutedText)
                    }
                }
                HorizontalDivider(color = CardBorder)

                if (isLoading) {
                    Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = ForestGreen, modifier = Modifier.size(28.dp))
                    }
                } else {
                    Text(
                        text = "Section details and workflows for $sectionTitle are backed by the website database at zerasworld.in.",
                        fontSize = 13.sp,
                        color = InkColor,
                        lineHeight = 18.sp
                    )
                    if (sectionContent != null && sectionContent!!.isNotBlank()) {
                        Surface(
                            color = IvoryBg,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Live Data Synced: $sectionTitle",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = ForestGreen,
                                modifier = Modifier.padding(12.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AlertsTab(
    sessionManager: AdminSessionManager,
    repository: AdminApiRepository,
    fcmToken: String,
    isTokenRegistered: Boolean,
    onTokenRegisterClick: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var notificationLogs by remember { mutableStateOf(sessionManager.getNotificationLogs()) }
    var isSendingTestAlert by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, CardBorder),
                shape = RoundedCornerShape(14.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Text("Firebase Notification Setup", fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = ForestGreen)
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(imageVector = if (isTokenRegistered) Icons.Default.CheckCircle else Icons.Default.Warning, contentDescription = null, tint = if (isTokenRegistered) Color(0xFF16A34A) else Color(0xFFEAB308), modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = if (isTokenRegistered) "Device Registered on Server" else "Not Registered on Server", fontWeight = FontWeight.SemiBold, color = if (isTokenRegistered) Color(0xFF16A34A) else Color(0xFFCA8A04))
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    Text("FCM Device Token:", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MutedText)
                    Text(text = fcmToken, fontSize = 11.sp, color = InkColor, modifier = Modifier.fillMaxWidth().background(IvoryBg, RoundedCornerShape(6.dp)).padding(10.dp))
                    Spacer(modifier = Modifier.height(14.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = onTokenRegisterClick,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(1.dp, ForestGreen)
                        ) {
                            Icon(Icons.Default.Sync, contentDescription = null, tint = ForestGreen, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Register Token", fontSize = 11.sp, color = ForestGreen, fontWeight = FontWeight.Bold)
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
                            colors = ButtonDefaults.buttonColors(containerColor = ForestGreen),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) { Text("Test Order Alert", fontSize = 11.sp) }
                    }
                }
            }
        }
        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Received Push Alerts Log", fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = ForestGreen)
                if (notificationLogs.isNotEmpty()) {
                    TextButton(onClick = { sessionManager.clearNotificationLogs(); notificationLogs = emptyList() }) { Text("Clear Log", fontSize = 12.sp, color = Color.Red) }
                }
            }
        }
        if (notificationLogs.isEmpty()) {
            item { Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { Text("No push alerts received yet.", color = MutedText) } }
        } else {
            items(notificationLogs) { log ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, CardBorder),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = when (log.type) {
                                "ORDER_ALERT" -> Icons.Default.ShoppingCart
                                "RETURN_ALERT" -> Icons.Default.AssignmentReturn
                                else -> Icons.Default.Notifications
                            },
                            contentDescription = null,
                            tint = when (log.type) {
                                "ORDER_ALERT" -> ForestGreen
                                "RETURN_ALERT" -> LuxuryGold
                                else -> ForestDeep
                            },
                            modifier = Modifier.size(28.dp)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(log.title, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = ForestGreen)
                            Text(log.body, fontSize = 13.sp, color = InkColor)
                            Text(SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault()).format(Date(log.timestamp)), fontSize = 10.sp, color = MutedText, modifier = Modifier.padding(top = 4.dp))
                        }
                    }
                }
            }
        }
    }
}
