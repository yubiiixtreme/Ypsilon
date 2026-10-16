import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import SddmComponents 2.0

// Ypsilon login screen: dark glass card, clock, user + password + session picker.
// Palette mirrors the Ypsilon dark theme (bg #0b0e1a, primary #7c7cff).
Rectangle {
    id: root
    width: 640
    height: 480

    property int sessionIndex: sessionModel.lastIndex
    property string errorMessage: ""

    QtObject {
        id: pal
        property color bg: "#0b0e1a"
        property color card: "#151824"
        property color cardEdge: "#232741"
        property color primary: "#7c7cff"
        property color onPrimary: "#0b0e1a"
        property color fg: "#e6e9f5"
        property color muted: "#8b90a7"
        property color bad: "#e06565"
    }

    color: pal.bg

    // faint glow behind the card
    Rectangle {
        anchors.centerIn: card
        width: card.width + 120
        height: card.height + 120
        radius: 48
        color: pal.primary
        opacity: 0.07
    }

    ColumnLayout {
        id: card
        anchors.centerIn: parent
        width: 340
        spacing: 10

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: childrenRect.height + 44
            radius: 24
            color: pal.card
            border.color: pal.cardEdge
            border.width: 1

            ColumnLayout {
                width: parent.width - 56
                anchors.horizontalCenter: parent.horizontalCenter
                y: 22
                spacing: 10

                Clock {
                    id: clock
                    Layout.alignment: Qt.AlignHCenter
                    color: pal.fg
                    font.pixelSize: 44
                    font.weight: Font.DemiBold
                    timeFont.family: "Inter"
                }

                Text {
                    Layout.alignment: Qt.AlignHCenter
                    text: Qt.formatDateTime(new Date(), "dddd, d MMMM")
                    color: pal.muted
                    font.pixelSize: 13
                }

                Text {
                    Layout.alignment: Qt.AlignHCenter
                    text: "Y Ypsilon"
                    color: pal.primary
                    font.pixelSize: 17
                    font.weight: Font.Bold
                    topPadding: 6
                }

                ComboBox {
                    id: user
                    Layout.fillWidth: true
                    model: userModel
                    currentIndex: userModel.lastIndex
                    textRole: "name"
                }

                PasswordBox {
                    id: password
                    Layout.fillWidth: true
                    placeholderText: "Password"
                    Keys.onReturnPressed: loginButton.clicked()
                }

                ComboBox {
                    id: session
                    Layout.fillWidth: true
                    model: sessionModel
                    currentIndex: sessionModel.lastIndex
                    textRole: "name"
                    onCurrentIndexChanged: root.sessionIndex = currentIndex
                }

                Button {
                    id: loginButton
                    Layout.fillWidth: true
                    text: "Log in"
                    highlighted: true
                    onClicked: sddm.login(user.currentText, password.text, root.sessionIndex)
                }

                Text {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 18
                    horizontalAlignment: Text.AlignHCenter
                    text: root.errorMessage
                    color: pal.bad
                    font.pixelSize: 12
                    visible: root.errorMessage !== ""
                }
            }
        }

        RowLayout {
            Layout.alignment: Qt.AlignHCenter
            spacing: 8
            Button {
                text: "Shut down"
                flat: true
                onClicked: sddm.powerOff()
            }
            Button {
                text: "Reboot"
                flat: true
                onClicked: sddm.reboot()
            }
        }
    }

    Connections {
        function onLoginSucceeded() {
            root.errorMessage = ""
        }
        function onLoginFailed() {
            root.errorMessage = "Sorry, that didn't work — try again"
            password.text = ""
            password.focus = true
        }
        target: sddm
    }

    Component.onCompleted: {
        password.focus = true
    }
}
