import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _

class ComplexPasswordValidator:
    """
    Securely enforces password complexity on the backend.
    """
    def validate(self, password, user=None):
        if not re.search(r'[A-Z]', password):
            raise ValidationError(_("Password must contain at least one uppercase letter."), code='password_no_upper')
        if not re.search(r'[a-z]', password):
            raise ValidationError(_("Password must contain at least one lowercase letter."), code='password_no_lower')
        if not re.search(r'[0-9]', password):
            raise ValidationError(_("Password must contain at least one number."), code='password_no_number')
        if not re.search(r'[^A-Za-z0-9]', password):
            raise ValidationError(_("Password must contain at least one special character."), code='password_no_special')

    def get_help_text(self):
        return _(
            "Your password must contain at least one uppercase letter, one lowercase letter, one number, and one special character."
        )