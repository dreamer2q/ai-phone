from types import SimpleNamespace
from ai_phone.agent.drivers.android import AndroidDriver, _current_focus_package


def driver(device):
    instance = AndroidDriver.__new__(AndroidDriver)
    instance._device = device
    instance.serial = device.serial
    return instance


def test_android15_current_window_wins_over_stale_activity():
    d = SimpleNamespace(serial="emulator-5554", shell=lambda _: "mCurrentFocus=null\nmCurrentFocus=Window{abc u0 org.fossify.math/.MainActivity}", app_current=lambda: SimpleNamespace(package="com.android.chrome"))
    assert driver(d).current_app() == "org.fossify.math"


def test_anr_overlay_does_not_confirm_app_behind_it():
    dump = "mCurrentFocus=Window{abc u0 Application Not Responding: com.google.android.youtube}\nmFocusedApp=ActivityRecord{a u0 org.fossify.math/.MainActivity}"
    assert _current_focus_package(dump) == ""


def test_null_focus_does_not_use_historical_task():
    d = SimpleNamespace(serial="emulator-5554", shell=lambda _: "mCurrentFocus=null", app_current=lambda: SimpleNamespace(package="org.fossify.math"))
    assert driver(d).current_app() == ""


def test_legacy_fallback_when_focus_fields_are_absent():
    d = SimpleNamespace(serial="emulator-5554", shell=lambda _: "old dump", app_current=lambda: SimpleNamespace(package="org.fossify.math"))
    assert driver(d).current_app() == "org.fossify.math"


def test_physical_device_keeps_existing_reader():
    def unexpected(_):
        raise AssertionError("Physical device must retain the existing reader")
    d = SimpleNamespace(serial="physical-test", shell=unexpected, app_current=lambda: SimpleNamespace(package="physical.app"))
    assert driver(d).current_app() == "physical.app"
