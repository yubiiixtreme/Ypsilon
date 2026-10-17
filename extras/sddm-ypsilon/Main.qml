import QtQuick 2.15
import QtQuick.Effects
import SddmComponents 2.0

// Ypsilon login screen, Lumina-inspired: blurred wallpaper, big Rubik clock, avatar,
// a single pill password field and a bottom row of pill buttons (user, session, power).
// Icons are Material Symbols Rounded (ligatures); fonts ship in /usr/share/fonts/lumina-sddm,
// with a plain-text fallback when they are missing.
Rectangle {
    id: root
    width: 1280
    height: 720
    color: pal.bg

    property string errorMessage: ""
    property int userIndex: userModel.lastIndex >= 0 ? userModel.lastIndex : 0
    property int sessionIndex: sessionModel.lastIndex >= 0 ? sessionModel.lastIndex : 0
    property bool busy: false

    QtObject {
        id: pal
        property color bg: "#0b0e1a"
        property color surface: "#cc151824"
        property color surfaceHi: "#e6232741"
        property color primary: "#7c7cff"
        property color primaryHi: "#9494ff"
        property color textOnPrimary: "#0b0e1a"
        property color fg: "#e6e9f5"
        property color muted: "#a4a9c2"
        property color bad: "#ff8a8a"
    }

    readonly property string sans: "Rubik"
    readonly property string icons: "Material Symbols Rounded"

    // collect names/icons out of the C++ models
    Repeater {
        id: users
        model: userModel
        delegate: Item {
            property string login: model.name
            property string shown: model.realName && model.realName !== "" ? model.realName : model.name
            property string face: model.icon
        }
    }
    Repeater {
        id: sessions
        model: sessionModel
        delegate: Item { property string label: model.name }
    }
    readonly property var curUser: users.count > 0 ? users.itemAt(userIndex) : null
    readonly property var curSession: sessions.count > 0 ? sessions.itemAt(sessionIndex) : null

    function submit() {
        if (!curUser || busy) return
        busy = true
        errorMessage = ""
        sddm.login(curUser.login, input.text, sessionIndex)
    }

    // ---- background ----
    Image {
        id: wall
        anchors.fill: parent
        source: Qt.resolvedUrl("background.jpg")
        fillMode: Image.PreserveAspectCrop
        asynchronous: true
        visible: false
        sourceSize.width: 1920
    }
    MultiEffect {
        anchors.fill: parent
        source: wall
        blurEnabled: true
        blur: 1.0
        blurMax: 32
        brightness: 0.04
        saturation: 0.1
    }
    Rectangle {
        anchors.fill: parent
        gradient: Gradient {
            GradientStop { position: 0.0; color: "#18000000" }
            GradientStop { position: 1.0; color: "#800b0e1a" }
        }
    }

    // ---- clock ----
    Column {
        id: clockBox
        anchors.horizontalCenter: parent.horizontalCenter
        y: parent.height * 0.12
        spacing: 0
        Text {
            id: clock
            anchors.horizontalCenter: parent.horizontalCenter
            property date now: new Date()
            text: Qt.formatTime(now, "hh:mm")
            color: pal.fg
            font.family: root.sans
            font.pixelSize: Math.max(72, root.height * 0.2)
            font.weight: Font.Medium
            Timer { interval: 1000; running: true; repeat: true; onTriggered: clock.now = new Date() }
        }
        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: Qt.formatDate(clock.now, "dddd, d MMMM")
            color: pal.muted
            font.family: root.sans
            font.pixelSize: 20
        }
    }

    // ---- avatar + name + password pill ----
    Column {
        id: loginBox
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.top: clockBox.bottom
        anchors.topMargin: root.height * 0.07
        spacing: 14

        Rectangle {
            id: avatar
            anchors.horizontalCenter: parent.horizontalCenter
            width: 96; height: 96; radius: 48
            color: pal.primary
            border.width: 3
            border.color: "#40ffffff"
            clip: true
            Image {
                id: face
                anchors.fill: parent
                source: root.curUser && root.curUser.face ? "file://" + root.curUser.face : ""
                fillMode: Image.PreserveAspectCrop
                visible: status === Image.Ready
            }
            Text {
                anchors.centerIn: parent
                visible: face.status !== Image.Ready
                text: root.curUser ? root.curUser.shown.charAt(0).toUpperCase() : "?"
                color: pal.textOnPrimary
                font.family: root.sans
                font.pixelSize: 40
                font.weight: Font.Medium
            }
        }

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: root.curUser ? root.curUser.shown : ""
            color: pal.fg
            font.family: root.sans
            font.pixelSize: 20
            font.weight: Font.Medium
        }

        Rectangle {
            id: pill
            anchors.horizontalCenter: parent.horizontalCenter
            width: 340; height: 52; radius: 26
            color: pal.surface
            border.width: input.activeFocus ? 2 : 1
            border.color: input.activeFocus ? pal.primary : "#30ffffff"

            // shake on a failed login
            SequentialAnimation on x {
                id: shake
                running: false
                NumberAnimation { to: pill.x - 10; duration: 50 }
                NumberAnimation { to: pill.x + 10; duration: 80 }
                NumberAnimation { to: pill.x - 6; duration: 60 }
                NumberAnimation { to: pill.x; duration: 50 }
            }

            Text {
                id: lockIcon
                anchors.left: parent.left; anchors.leftMargin: 18
                anchors.verticalCenter: parent.verticalCenter
                text: "lock"
                color: pal.muted
                font.family: root.icons
                font.pixelSize: 22
            }
            TextInput {
                id: input
                anchors.left: lockIcon.right; anchors.leftMargin: 10
                anchors.right: go.left; anchors.rightMargin: 8
                anchors.verticalCenter: parent.verticalCenter
                echoMode: TextInput.Password
                passwordCharacter: "•"
                color: pal.fg
                font.family: root.sans
                font.pixelSize: 16
                clip: true
                focus: true
                enabled: !root.busy
                onAccepted: root.submit()
                Text {
                    visible: input.text === "" && !input.preeditText
                    text: "Password"
                    color: pal.muted
                    font: input.font
                }
            }
            Rectangle {
                id: go
                anchors.right: parent.right; anchors.rightMargin: 6
                anchors.verticalCenter: parent.verticalCenter
                width: 40; height: 40; radius: 20
                color: goArea.containsMouse ? pal.primaryHi : pal.primary
                opacity: root.busy ? 0.5 : 1
                Behavior on color { ColorAnimation { duration: 120 } }
                Text {
                    anchors.centerIn: parent
                    text: root.busy ? "progress_activity" : "arrow_forward"
                    color: pal.textOnPrimary
                    font.family: root.icons
                    font.pixelSize: 22
                }
                MouseArea { id: goArea; anchors.fill: parent; hoverEnabled: true; onClicked: root.submit() }
            }
        }

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            height: 20
            text: root.errorMessage
            color: pal.bad
            font.family: root.sans
            font.pixelSize: 14
        }
    }

    // ---- bottom bar: user · session · power ----
    Row {
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 36
        spacing: 12

        component PillButton: Rectangle {
            id: btn
            property string icon
            property string label
            signal clicked
            height: 44
            width: row.implicitWidth + 36
            radius: 22
            color: area.containsMouse ? pal.surfaceHi : pal.surface
            border.width: 1
            border.color: "#30ffffff"
            Behavior on color { ColorAnimation { duration: 120 } }
            Row {
                id: row
                anchors.centerIn: parent
                spacing: 8
                Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: btn.icon
                    color: pal.fg
                    font.family: root.icons
                    font.pixelSize: 20
                }
                Text {
                    anchors.verticalCenter: parent.verticalCenter
                    visible: btn.label !== ""
                    text: btn.label
                    color: pal.fg
                    font.family: root.sans
                    font.pixelSize: 14
                }
            }
            MouseArea { id: area; anchors.fill: parent; hoverEnabled: true; onClicked: btn.clicked() }
        }

        PillButton {
            visible: users.count > 1
            icon: "person"
            label: root.curUser ? root.curUser.shown : ""
            onClicked: root.userIndex = (root.userIndex + 1) % users.count
        }
        PillButton {
            visible: sessions.count > 0
            icon: "desktop_windows"
            label: root.curSession ? root.curSession.label : ""
            onClicked: root.sessionIndex = (root.sessionIndex + 1) % sessions.count
        }
        PillButton { icon: "restart_alt"; label: ""; onClicked: sddm.reboot() }
        PillButton { icon: "power_settings_new"; label: ""; onClicked: sddm.powerOff() }
    }

    Connections {
        target: sddm
        function onLoginSucceeded() { root.errorMessage = ""; }
        function onLoginFailed() {
            root.busy = false
            root.errorMessage = "Wrong password, try again"
            input.text = ""
            input.forceActiveFocus()
            shake.restart()
        }
    }

    Component.onCompleted: input.forceActiveFocus()
}
